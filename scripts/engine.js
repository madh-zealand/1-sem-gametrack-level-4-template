(function () {
  function VisualNovelEngine(options) {
    this.startSceneId = options.startSceneId;
    this.root = options.root;
    this.dialogText = options.dialogText;
    this.speakerName = options.speakerName;
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

    this.handleContinueClick = this.handleContinueClick.bind(this);
    this.continueButton.addEventListener("click", this.handleContinueClick);
  }

  VisualNovelEngine.prototype.handleContinueClick = function () {
    if (!this.waitingForClick) {
      return;
    }

    this.waitingForClick = false;
    this.continueButton.classList.add("is-hidden");
    this.continueScene(this.flowToken);
  };

  VisualNovelEngine.prototype.start = function () {
    this.goTo(this.startSceneId);
  };

  VisualNovelEngine.prototype.resetState = function () {
    this.state = {};
    this.updateDebugPanel();
  };

  VisualNovelEngine.prototype.clearChoices = function () {
    this.choiceList.innerHTML = "";
  };

  VisualNovelEngine.prototype.setDialog = function (speaker, text) {
    this.speakerName.textContent = speaker || "Narrator";
    this.dialogText.textContent = text || "";
  };

  VisualNovelEngine.prototype.setActiveCharacter = function (characterName) {
    if (!this.currentScene) {
      return;
    }

    var characters = this.currentScene.querySelectorAll("[data-char]");
    characters.forEach(function (character) {
      character.classList.remove("active");
    });

    if (!characterName) {
      return;
    }

    var activeCharacter = this.currentScene.querySelector('[data-char="' + characterName + '"]');

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
    var halfDuration = Math.max(Math.round(fadeDuration / 2), 1);
    var preload = new window.Image();

    if (!element || element.tagName !== "IMG") {
      return false;
    }

    preload.src = src;
    element.classList.add("is-swapping");

    window.setTimeout(function () {
      if (token !== engine.flowToken) {
        return;
      }

      element.src = src;

      function finishSwap() {
        if (token !== engine.flowToken) {
          return;
        }

        window.requestAnimationFrame(function () {
          element.classList.remove("is-swapping");

          window.setTimeout(function () {
            if (token === engine.flowToken) {
              engine.continueScene(token);
            }
          }, halfDuration);
        });
      }

      if (preload.complete) {
        finishSwap();
        return;
      }

      preload.onload = finishSwap;
      preload.onerror = finishSwap;
    }, halfDuration);

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
    this.clearChoices();
    this.continueButton.classList.add("is-hidden");

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

    this.clearChoices();
    this.continueButton.classList.add("is-hidden");
  };

  VisualNovelEngine.prototype.executeStep = function (step, token) {
    var stepType = step.dataset.step;

    if (stepType === "say") {
      this.setDialog(step.dataset.speaker, step.textContent.trim());
      this.setActiveCharacter(step.dataset.character || "");
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
      this.waitingForClick = true;
      this.clearChoices();
      this.continueButton.classList.remove("is-hidden");
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
    var engine = this;
    this.clearChoices();
    this.continueButton.classList.add("is-hidden");

    Array.from(step.querySelectorAll("button")).forEach(function (templateButton) {
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

        engine.clearChoices();

        if (templateButton.dataset.next) {
          engine.goTo(templateButton.dataset.next);
          return;
        }

        engine.continueScene(token);
      });

      engine.choiceList.appendChild(button);
    });
  };

  window.VisualNovelEngine = VisualNovelEngine;
}());
