(function () {
  function VisualNovelEngine(options) {
    this.startSceneId = options.startSceneId;
    this.root = options.root;
    this.dialogText = options.dialogText;
    this.speakerName = options.speakerName;
    this.dialogPanel = options.dialogPanel;
    this.choiceList = options.choiceList;
    this.continueButton = options.continueButton;
    this.debugScene = options.debugScene;
    this.stateOutput = options.stateOutput;
    this.state = {};
    this.actions = {};
    this.currentScene = null;
    this.currentSteps = [];
    this.stepIndex = 0;
    this.flowToken = 0;
    this.waitingForClick = false;
    this.imageCache = {};

    this.handleContinueClick = this.handleContinueClick.bind(this);
    this.continueButton.addEventListener("click", this.handleContinueClick);
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function expandHex(hex) {
    if (hex.length === 4) {
      return "#" + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3);
    }

    return hex;
  }

  function parseHexColor(hex) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || "")) {
      return null;
    }

    var normalized = expandHex(hex);

    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16)
    };
  }

  function mixColors(base, target, amount) {
    return {
      r: clampChannel(base.r + (target.r - base.r) * amount),
      g: clampChannel(base.g + (target.g - base.g) * amount),
      b: clampChannel(base.b + (target.b - base.b) * amount)
    };
  }

  function rgbString(color, alpha) {
    if (typeof alpha === "number") {
      return "rgba(" + color.r + ", " + color.g + ", " + color.b + ", " + alpha + ")";
    }

    return "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
  }

  VisualNovelEngine.prototype.handleContinueClick = function () {
    if (!this.waitingForClick) {
      return;
    }

    this.waitingForClick = false;
    this.hideContinueButton();
    this.continueScene(this.flowToken);
  };

  VisualNovelEngine.prototype.start = function () {
    this.preloadImages();
    this.goTo(this.startSceneId);
  };

  VisualNovelEngine.prototype.preloadImage = function (src) {
    var preload;

    if (!src) {
      return null;
    }

    if (this.imageCache[src]) {
      return this.imageCache[src];
    }

    preload = new window.Image();
    preload.src = src;
    this.imageCache[src] = preload;
    return preload;
  };

  VisualNovelEngine.prototype.isImageReady = function (src) {
    var image = this.imageCache[src];

    return Boolean(image && image.complete && image.naturalWidth > 0);
  };

  VisualNovelEngine.prototype.preloadImages = function () {
    var engine = this;

    if (!this.root) {
      return;
    }

    this.root.querySelectorAll("img[src]").forEach(function (image) {
      engine.preloadImage(image.getAttribute("src"));
    });

    this.root.querySelectorAll('[data-step="swap-image"][data-src]').forEach(function (step) {
      engine.preloadImage(step.dataset.src);
    });
  };

  VisualNovelEngine.prototype.resetState = function () {
    this.state = {};
    this.updateDebugPanel();
  };

  VisualNovelEngine.prototype.clearChoices = function () {
    this.choiceList.innerHTML = "";
  };

  VisualNovelEngine.prototype.hideContinueButton = function () {
    this.continueButton.classList.add("is-hidden");
  };

  VisualNovelEngine.prototype.showContinueButton = function () {
    this.continueButton.classList.remove("is-hidden");
  };

  VisualNovelEngine.prototype.clearActions = function () {
    this.waitingForClick = false;
    this.hideContinueButton();
    this.clearChoices();
  };

  VisualNovelEngine.prototype.createChoiceButton = function (templateButton, step, token) {
    var engine = this;
    var button = document.createElement("button");

    button.type = "button";
    button.textContent = templateButton.textContent.trim();

    button.addEventListener("click", function () {
      if (token !== engine.flowToken) {
        return;
      }

      if (templateButton.dataset.run) {
        engine.runAction(templateButton.dataset.run, {
          button: templateButton,
          sourceStep: step
        });
      }

      if (token !== engine.flowToken) {
        return;
      }

      engine.clearActions();

      if (templateButton.dataset.next) {
        engine.goTo(templateButton.dataset.next);
        return;
      }

      engine.continueScene(token);
    });

    return button;
  };

  VisualNovelEngine.prototype.applyDialogColor = function (hexColor) {
    var panel = this.dialogPanel;

    if (!panel) {
      return;
    }

    var color = parseHexColor(hexColor);

    if (!color) {
      panel.style.removeProperty("--dialog-border-color");
      panel.style.removeProperty("--dialog-bg-top");
      panel.style.removeProperty("--dialog-bg-bottom");
      panel.style.removeProperty("--speaker-bg");
      panel.style.removeProperty("--speaker-text");
      return;
    }

    var border = mixColors(color, { r: 24, g: 32, b: 38 }, 0.18);
    var bgTop = mixColors(color, { r: 255, g: 255, b: 255 }, 0.9);
    var bgBottom = mixColors(color, { r: 245, g: 232, b: 214 }, 0.82);
    var speakerBg = mixColors(color, { r: 255, g: 255, b: 255 }, 0.78);
    var speakerText = mixColors(color, { r: 24, g: 32, b: 38 }, 0.35);

    panel.style.setProperty("--dialog-border-color", rgbString(border));
    panel.style.setProperty("--dialog-bg-top", rgbString(bgTop, 0.96));
    panel.style.setProperty("--dialog-bg-bottom", rgbString(bgBottom, 0.98));
    panel.style.setProperty("--speaker-bg", rgbString(speakerBg, 0.9));
    panel.style.setProperty("--speaker-text", rgbString(speakerText));
  };

  VisualNovelEngine.prototype.setDialog = function (speaker, text, hexColor) {
    this.speakerName.textContent = speaker || "";
    this.dialogText.textContent = text || "";
    this.speakerName.classList.toggle("is-hidden", !speaker);
    this.applyDialogColor(hexColor);
  };

  VisualNovelEngine.prototype.setActiveCharacter = function (selector) {
    if (!this.currentScene) {
      return;
    }

    var characters = this.currentScene.querySelectorAll("[data-char]");
    characters.forEach(function (character) {
      character.classList.remove("active");
    });

    if (!selector) {
      return;
    }

    var activeCharacter = this.currentScene.querySelector(selector);

    if (activeCharacter) {
      activeCharacter.classList.add("active");
    }
  };

  VisualNovelEngine.prototype.showElement = function (selector) {
    if (!this.currentScene) {
      return;
    }

    var element = this.currentScene.querySelector(selector);

    if (element) {
      element.classList.remove("is-hidden");
    }
  };

  VisualNovelEngine.prototype.hideElement = function (selector) {
    if (!this.currentScene) {
      return;
    }

    var element = this.currentScene.querySelector(selector);

    if (element) {
      element.classList.add("is-hidden");
      element.classList.remove("active");
    }
  };

  VisualNovelEngine.prototype.swapImage = function (selector, src, token, duration) {
    if (!this.currentScene || !src) {
      return false;
    }

    var element = this.currentScene.querySelector(selector);
    var engine = this;
    var fadeDuration = Number(duration || 220);
    var preload = this.preloadImage(src);
    var startSwap;

    if (!element || element.tagName !== "IMG") {
      return false;
    }

    startSwap = function () {
      var clone = element.cloneNode(false);
      var previousTransitionDuration = element.style.transitionDuration;

      clone.removeAttribute("data-char");
      clone.removeAttribute("data-item");
      clone.classList.remove("active");
      clone.classList.add("is-swap-clone");
      clone.style.transitionDuration = fadeDuration + "ms";
      element.style.transitionDuration = fadeDuration + "ms";

      element.classList.add("is-swapping");
      element.insertAdjacentElement("afterend", clone);
      element.src = src;

      clone.offsetWidth;

      window.requestAnimationFrame(function () {
        if (token !== engine.flowToken) {
          element.style.transitionDuration = previousTransitionDuration;
          clone.remove();
          return;
        }

        window.requestAnimationFrame(function () {
          if (token !== engine.flowToken) {
            element.style.transitionDuration = previousTransitionDuration;
            clone.remove();
            return;
          }

          clone.classList.add("is-swapping");
          element.classList.remove("is-swapping");
        });
      });

      window.setTimeout(function () {
        clone.remove();
        element.style.transitionDuration = previousTransitionDuration;

        if (token === engine.flowToken) {
          engine.continueScene(token);
        }
      }, fadeDuration);
    };

    if (this.isImageReady(src)) {
      startSwap();
      return true;
    }

    preload.onload = startSwap;
    preload.onerror = startSwap;

    return true;
  };

  VisualNovelEngine.prototype.updateDebugPanel = function () {
    this.debugScene.textContent = this.currentScene ? this.currentScene.id : "none";
    this.stateOutput.textContent = JSON.stringify(this.state, null, 2);
  };

  VisualNovelEngine.prototype.runAction = function (actionName, details) {
    var action = this.actions[actionName];

    if (typeof action !== "function") {
      console.warn('Action "' + actionName + '" was not found.');
      return;
    }

    return action(this, details || {});
  };

  VisualNovelEngine.prototype.goTo = function (sceneId) {
    var nextScene = this.root.querySelector("#" + sceneId);

    if (!nextScene) {
      console.warn('Scene "' + sceneId + '" was not found.');
      return;
    }

    this.flowToken += 1;
    this.waitingForClick = false;
    this.clearActions();

    var scenes = this.root.querySelectorAll(".scene");
    scenes.forEach(function (scene) {
      scene.classList.remove("is-active");
    });

    nextScene.classList.add("is-active");
    this.currentScene = nextScene;
    this.currentSteps = Array.from(nextScene.querySelectorAll(".steps [data-step]"));
    this.stepIndex = 0;
    this.updateDebugPanel();
    this.continueScene(this.flowToken);
  };

  VisualNovelEngine.prototype.continueScene = function (token) {
    if (token !== this.flowToken || !this.currentScene) {
      return;
    }

    while (this.stepIndex < this.currentSteps.length) {
      var step = this.currentSteps[this.stepIndex];
      this.stepIndex += 1;

      var outcome = this.executeStep(step, token);

      if (outcome === "pause" || outcome === "scene-changed") {
        return;
      }
    }

    this.clearActions();
  };

  VisualNovelEngine.prototype.executeStep = function (step, token) {
    var stepType = step.dataset.step;

    if (stepType === "say") {
      this.setDialog(step.dataset.speaker, step.textContent.trim(), step.dataset.color);
      return "continue";
    }

    if (stepType === "focus") {
      this.setActiveCharacter(step.dataset.target || "");
      return "continue";
    }

    if (stepType === "show") {
      this.showElement(step.dataset.target);
      return "continue";
    }

    if (stepType === "hide") {
      this.hideElement(step.dataset.target);
      return "continue";
    }

    if (stepType === "swap-image") {
      if (this.swapImage(step.dataset.target, step.dataset.src, token, step.dataset.duration)) {
        return "pause";
      }

      return "continue";
    }

    if (stepType === "run") {
      var actionResult = this.runAction(step.dataset.action, { step: step });

      if (typeof actionResult === "string") {
        this.goTo(actionResult);
        return "scene-changed";
      }

      if (token !== this.flowToken) {
        return "scene-changed";
      }

      return "continue";
    }

    if (stepType === "goto") {
      this.goTo(step.dataset.scene);
      return "scene-changed";
    }

    if (stepType === "wait-click") {
      this.clearChoices();
      this.waitingForClick = true;
      this.showContinueButton();
      return "pause";
    }

    if (stepType === "wait-ms") {
      var waitTime = Number(step.dataset.ms || 0);
      var engine = this;

      window.setTimeout(function () {
        if (token === engine.flowToken) {
          engine.continueScene(token);
        }
      }, waitTime);

      return "pause";
    }

    if (stepType === "choice") {
      this.renderChoices(step, token);
      return "pause";
    }

    console.warn('Step type "' + stepType + '" is not supported.');
    return "continue";
  };

  VisualNovelEngine.prototype.renderChoices = function (step, token) {
    this.clearActions();

    Array.from(step.querySelectorAll("button")).forEach(function (templateButton) {
      this.choiceList.appendChild(this.createChoiceButton(templateButton, step, token));
    }, this);
  };

  window.VisualNovelEngine = VisualNovelEngine;
}());
