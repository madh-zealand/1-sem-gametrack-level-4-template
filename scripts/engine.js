// @ts-check

/**
 * @typedef {Record<string, unknown>} VisualNovelState
 * @typedef {HTMLElement | string | null | undefined} ElementTarget
 * @typedef {{ r: number, g: number, b: number }} RgbColor
 * @typedef {{ button?: HTMLElement, element?: HTMLElement, sourceStep?: HTMLElement, step?: HTMLElement, event?: Event }} EngineActionDetails
 * @typedef {{ element: HTMLElement }} EngineConditionContext
 * @typedef {(game: VisualNovelEngine, details: EngineActionDetails) => (string | void | null)} EngineAction
 * @typedef {(game: VisualNovelEngine, context: EngineConditionContext) => boolean} EngineCondition
 * @typedef {"continue" | "pause" | "scene-changed"} StepOutcome
 */

/**
 * @typedef {object} VisualNovelEngineOptions
 * @property {string} startSceneId
 * @property {ElementTarget=} viewport
 * @property {ElementTarget=} root
 * @property {ElementTarget=} dialogPanel
 * @property {ElementTarget=} dialogText
 * @property {ElementTarget=} speakerName
 * @property {ElementTarget=} choiceList
 * @property {ElementTarget=} continueButton
 * @property {ElementTarget=} storyUi
 * @property {ElementTarget=} debugPanel
 * @property {ElementTarget=} debugScene
 * @property {ElementTarget=} stateOutput
 * @property {Iterable<HTMLAudioElement> | ArrayLike<HTMLAudioElement>=} audioElements
 * @property {VisualNovelState=} initialState
 * @property {Record<string, EngineAction>=} actions
 * @property {Record<string, EngineCondition>=} conditions
 * @property {number=} designWidth
 * @property {number=} designHeight
 * @property {string | false=} globalName
 */

/**
 * @typedef {object} ResolvedVisualNovelEngineOptions
 * @property {string} startSceneId
 * @property {HTMLElement | null} viewport
 * @property {HTMLElement} root
 * @property {HTMLElement} dialogPanel
 * @property {HTMLElement} dialogText
 * @property {HTMLElement} speakerName
 * @property {HTMLElement} choiceList
 * @property {HTMLButtonElement} continueButton
 * @property {HTMLElement} storyUi
 * @property {HTMLDetailsElement | null} debugPanel
 * @property {HTMLElement | null} debugScene
 * @property {HTMLElement | null} stateOutput
 * @property {HTMLAudioElement[]} audioElements
 * @property {VisualNovelState} initialState
 * @property {Record<string, EngineAction>} actions
 * @property {Record<string, EngineCondition>} conditions
 * @property {number} designWidth
 * @property {number} designHeight
 */

const DEFAULT_SELECTORS = Object.freeze({
  viewport: '.viewport',
  root: '.stage-screen',
  dialogPanel: '.dialog-panel',
  dialogText: '#dialog-text',
  speakerName: '#speaker-name',
  choiceList: '#choice-list',
  continueButton: '#continue-button',
  storyUi: '.story-ui',
  debugPanel: '.debug-panel',
  debugScene: '#debug-scene',
  stateOutput: '#state-output',
  audio: 'audio',
});

const DEFAULT_DESIGN_SIZE = Object.freeze({
  width: 1440,
  height: 1080,
});

/**
 * @param {VisualNovelState | null | undefined} state
 * @returns {VisualNovelState}
 */
function copyState(state) {
  return { ...(state || {}) };
}

/**
 * @param {ElementTarget} value
 * @param {string} fallbackSelector
 * @returns {HTMLElement | null}
 */
function resolveElement(value, fallbackSelector) {
  const target = value ?? fallbackSelector;

  if (!target) {
    return null;
  }

  if (typeof target === 'string') {
    return /** @type {HTMLElement | null} */ (document.querySelector(target));
  }

  return target;
}

/**
 * @template {HTMLElement} TElement
 * @param {TElement | null} element
 * @param {string} label
 * @returns {TElement}
 */
function requireElement(element, label) {
  if (!element) {
    throw new Error(`VisualNovelEngine could not find ${label}.`);
  }

  return element;
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * @param {string} hex
 * @returns {string}
 */
function expandHex(hex) {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex;
}

/**
 * @param {string | undefined} hex
 * @returns {RgbColor | null}
 */
function parseHexColor(hex) {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    return null;
  }

  const normalized = expandHex(hex);

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

/**
 * @param {RgbColor} base
 * @param {RgbColor} target
 * @param {number} amount
 * @returns {RgbColor}
 */
function mixColors(base, target, amount) {
  return {
    r: clampChannel(base.r + (target.r - base.r) * amount),
    g: clampChannel(base.g + (target.g - base.g) * amount),
    b: clampChannel(base.b + (target.b - base.b) * amount),
  };
}

/**
 * @param {RgbColor} color
 * @param {number=} alpha
 * @returns {string}
 */
function rgbString(color, alpha) {
  if (typeof alpha === 'number') {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export class VisualNovelEngine {
  /** @type {string} */
  startSceneId;

  /** @type {HTMLElement | null} */
  viewport;

  /** @type {HTMLElement} */
  root;

  /** @type {HTMLElement} */
  dialogPanel;

  /** @type {HTMLElement} */
  dialogText;

  /** @type {HTMLElement} */
  speakerName;

  /** @type {HTMLElement} */
  choiceList;

  /** @type {HTMLButtonElement} */
  continueButton;

  /** @type {HTMLElement} */
  storyUi;

  /** @type {HTMLDetailsElement | null} */
  debugPanel;

  /** @type {HTMLElement | null} */
  debugScene;

  /** @type {HTMLElement | null} */
  stateOutput;

  /** @type {HTMLAudioElement[]} */
  audioElements;

  /** @type {number} */
  designWidth;

  /** @type {number} */
  designHeight;

  /** @type {VisualNovelState} */
  initialState;

  /** @type {VisualNovelState} */
  state;

  /** @type {Record<string, EngineAction>} */
  actions;

  /** @type {Record<string, EngineCondition>} */
  conditions;

  /** @type {HTMLElement | null} */
  currentScene;

  /** @type {HTMLElement[]} */
  currentSteps;

  /** @type {number} */
  stepIndex;

  /** @type {number} */
  flowToken;

  /** @type {boolean} */
  waitingForClick;

  /** @type {Map<string, HTMLImageElement>} */
  imageCache;

  /**
   * @param {VisualNovelEngineOptions | undefined} options
   * @returns {VisualNovelEngine}
   */
  static create(options) {
    if (!options || !options.startSceneId) {
      throw new Error('VisualNovelEngine.create requires a startSceneId.');
    }

    const settings = options;

    return new VisualNovelEngine({
      startSceneId: settings.startSceneId,
      viewport: resolveElement(settings.viewport, DEFAULT_SELECTORS.viewport),
      root: requireElement(
        resolveElement(settings.root, DEFAULT_SELECTORS.root),
        'the stage root',
      ),
      dialogPanel: requireElement(
        resolveElement(settings.dialogPanel, DEFAULT_SELECTORS.dialogPanel),
        'the dialog panel',
      ),
      dialogText: requireElement(
        resolveElement(settings.dialogText, DEFAULT_SELECTORS.dialogText),
        'the dialog text',
      ),
      speakerName: requireElement(
        resolveElement(settings.speakerName, DEFAULT_SELECTORS.speakerName),
        'the speaker label',
      ),
      choiceList: requireElement(
        resolveElement(settings.choiceList, DEFAULT_SELECTORS.choiceList),
        'the choice list',
      ),
      continueButton: requireElement(
        /** @type {HTMLButtonElement | null} */ (
          resolveElement(
            settings.continueButton,
            DEFAULT_SELECTORS.continueButton,
          )
        ),
        'the continue button',
      ),
      storyUi: requireElement(
        resolveElement(settings.storyUi, DEFAULT_SELECTORS.storyUi),
        'the story UI',
      ),
      debugPanel: /** @type {HTMLDetailsElement | null} */ (
        resolveElement(settings.debugPanel, DEFAULT_SELECTORS.debugPanel)
      ),
      debugScene: resolveElement(
        settings.debugScene,
        DEFAULT_SELECTORS.debugScene,
      ),
      stateOutput: resolveElement(
        settings.stateOutput,
        DEFAULT_SELECTORS.stateOutput,
      ),
      audioElements: Array.from(
        settings.audioElements ||
          document.querySelectorAll(DEFAULT_SELECTORS.audio),
      ),
      initialState: copyState(settings.initialState),
      actions: settings.actions || {},
      conditions: settings.conditions || {},
      designWidth: settings.designWidth || DEFAULT_DESIGN_SIZE.width,
      designHeight: settings.designHeight || DEFAULT_DESIGN_SIZE.height,
    });
  }

  /**
   * @param {VisualNovelEngineOptions | undefined} options
   * @returns {VisualNovelEngine | null}
   */
  static boot(options) {
    if (!options || !options.startSceneId) {
      throw new Error('VisualNovelEngine.boot requires a startSceneId.');
    }

    const settings = options;
    const launch = function () {
      const engine = VisualNovelEngine.create(settings);
      const globalName =
        settings.globalName === undefined ? 'game' : settings.globalName;

      if (globalName) {
        Reflect.set(window, globalName, engine);
      }

      engine.start();
      return engine;
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', launch, { once: true });
      return null;
    }

    return launch();
  }

  /**
   * @param {ResolvedVisualNovelEngineOptions} options
   */
  constructor(options) {
    if (!options.startSceneId) {
      throw new Error('VisualNovelEngine requires a startSceneId.');
    }

    this.startSceneId = options.startSceneId;
    this.viewport = options.viewport;
    this.root = options.root;
    this.dialogPanel = options.dialogPanel;
    this.dialogText = options.dialogText;
    this.speakerName = options.speakerName;
    this.choiceList = options.choiceList;
    this.continueButton = options.continueButton;
    this.storyUi = options.storyUi;
    this.debugPanel = options.debugPanel;
    this.debugScene = options.debugScene;
    this.stateOutput = options.stateOutput;
    /** @type {HTMLAudioElement[]} */
    this.audioElements = Array.from(options.audioElements || []);
    this.designWidth = options.designWidth;
    this.designHeight = options.designHeight;
    this.initialState = copyState(options.initialState || {});

    /** @type {VisualNovelState} */
    this.state = copyState(this.initialState);
    /** @type {Record<string, EngineAction>} */
    this.actions = {};
    /** @type {Record<string, EngineCondition>} */
    this.conditions = {};
    /** @type {HTMLElement | null} */
    this.currentScene = null;
    /** @type {HTMLElement[]} */
    this.currentSteps = [];
    this.stepIndex = 0;
    this.flowToken = 0;
    this.waitingForClick = false;
    this.imageCache = new Map();

    this.handleContinueClick = this.handleContinueClick.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    this.updateScale = this.updateScale.bind(this);

    this.registerActions(options.actions);
    this.registerConditions(options.conditions);
    this.bindEvents();
    this.updateDebugPanel();

    if (this.debugPanel) {
      this.debugPanel.open = false;
    }
  }

  /** @returns {void} */
  bindEvents() {
    this.continueButton.addEventListener('click', this.handleContinueClick);
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleDocumentKeydown);
    window.addEventListener('resize', this.updateScale);
  }

  /** @returns {void} */
  destroy() {
    this.continueButton.removeEventListener('click', this.handleContinueClick);
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
    window.removeEventListener('resize', this.updateScale);
  }

  /** @returns {void} */
  start() {
    this.preloadImages();
    this.updateScale();
    this.goTo(this.startSceneId);
  }

  /** @returns {void} */
  updateScale() {
    const scale = Math.min(
      window.innerWidth / this.designWidth,
      window.innerHeight / this.designHeight,
    );

    document.documentElement.style.setProperty('--scale', String(scale));

    if (this.viewport) {
      this.viewport.style.setProperty('--scale', String(scale));
    }
  }

  /**
   * @param {VisualNovelState=} updates
   * @returns {VisualNovelState}
   */
  setState(updates = {}) {
    this.state = {
      ...this.state,
      ...updates,
    };
    this.updateDebugPanel();
    this.refreshConditionalElements();
    return this.state;
  }

  /**
   * @returns {VisualNovelState}
   */
  resetState() {
    this.state = copyState(this.initialState);
    this.updateDebugPanel();
    this.refreshConditionalElements();
    return this.state;
  }

  /**
   * @param {string} name
   * @param {EngineAction} action
   * @returns {VisualNovelEngine}
   */
  registerAction(name, action) {
    if (typeof action !== 'function') {
      throw new TypeError(`Action "${name}" must be a function.`);
    }

    this.actions[name] = action;
    return this;
  }

  /**
   * @param {Record<string, EngineAction>=} actions
   * @returns {VisualNovelEngine}
   */
  registerActions(actions = {}) {
    Object.entries(actions).forEach(([name, action]) => {
      this.registerAction(name, action);
    });
    return this;
  }

  /**
   * @param {string} name
   * @param {EngineCondition} condition
   * @returns {VisualNovelEngine}
   */
  registerCondition(name, condition) {
    if (typeof condition !== 'function') {
      throw new TypeError(`Condition "${name}" must be a function.`);
    }

    this.conditions[name] = condition;
    return this;
  }

  /**
   * @param {Record<string, EngineCondition>=} conditions
   * @returns {VisualNovelEngine}
   */
  registerConditions(conditions = {}) {
    Object.entries(conditions).forEach(([name, condition]) => {
      this.registerCondition(name, condition);
    });
    return this;
  }

  /** @returns {void} */
  handleContinueClick() {
    if (!this.waitingForClick) {
      return;
    }

    this.waitingForClick = false;
    this.hideContinueButton();
    this.continueScene(this.flowToken);
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleDocumentClick(event) {
    const runButton =
      event.target instanceof Element
        ? /** @type {HTMLElement | null} */ (event.target.closest('[data-run]'))
        : null;

    if (!runButton || runButton.closest('.steps')) {
      return;
    }

    if (!this.isInteractiveElementAvailable(runButton)) {
      return;
    }

    const actionName = runButton.dataset.run;

    if (!actionName) {
      return;
    }

    const actionResult = this.runAction(actionName, {
      button: runButton,
      element: runButton,
      event,
    });

    if (typeof actionResult === 'string') {
      this.goTo(actionResult);
      return;
    }

    if (runButton.dataset.next) {
      this.goTo(runButton.dataset.next);
    }
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  handleDocumentKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const interactiveElement =
      event.target instanceof Element
        ? /** @type {HTMLElement | null} */ (event.target.closest('[data-run]'))
        : null;

    if (!interactiveElement || interactiveElement.tagName === 'BUTTON') {
      return;
    }

    if (!this.isInteractiveElementAvailable(interactiveElement)) {
      return;
    }

    event.preventDefault();
    interactiveElement.click();
  }

  /**
   * @param {string | null | undefined} src
   * @returns {HTMLImageElement | null}
   */
  preloadImage(src) {
    if (!src) {
      return null;
    }

    if (this.imageCache.has(src)) {
      return this.imageCache.get(src) || null;
    }

    const preload = new window.Image();
    preload.src = src;
    this.imageCache.set(src, preload);
    return preload;
  }

  /**
   * @param {string} src
   * @returns {boolean}
   */
  isImageReady(src) {
    const image = this.imageCache.get(src);
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  /** @returns {void} */
  preloadImages() {
    this.root.querySelectorAll('img[src]').forEach((node) => {
      const image = /** @type {HTMLImageElement} */ (node);
      this.preloadImage(image.getAttribute('src'));
    });

    this.root
      .querySelectorAll('[data-step="swap-image"][data-src]')
      .forEach((node) => {
        const step = /** @type {HTMLElement} */ (node);
        this.preloadImage(step.dataset.src);
      });
  }

  /** @returns {void} */
  clearChoices() {
    this.choiceList.innerHTML = '';
  }

  /** @returns {void} */
  hideContinueButton() {
    this.continueButton.classList.add('is-hidden');
  }

  /** @returns {void} */
  showContinueButton() {
    this.continueButton.classList.remove('is-hidden');
  }

  /** @returns {void} */
  clearActions() {
    this.waitingForClick = false;
    this.hideContinueButton();
    this.clearChoices();
  }

  /**
   * @param {HTMLButtonElement} templateButton
   * @param {HTMLElement} step
   * @param {number} token
   * @returns {HTMLButtonElement}
   */
  createChoiceButton(templateButton, step, token) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = templateButton.textContent.trim();

    button.addEventListener('click', () => {
      if (token !== this.flowToken) {
        return;
      }

      let actionResult = null;

      if (templateButton.dataset.run) {
        actionResult = this.runAction(templateButton.dataset.run, {
          button: templateButton,
          sourceStep: step,
        });
      }

      if (token !== this.flowToken) {
        return;
      }

      if (typeof actionResult === 'string') {
        this.goTo(actionResult);
        return;
      }

      this.clearActions();

      if (templateButton.dataset.next) {
        this.goTo(templateButton.dataset.next);
        return;
      }

      this.continueScene(token);
    });

    return button;
  }

  /**
   * @param {HTMLElement | null} element
   * @returns {boolean}
   */
  isInteractiveElementAvailable(element) {
    return Boolean(
      element &&
        !element.closest('.steps') &&
        !element.hasAttribute('disabled') &&
        !element.classList.contains('is-hidden'),
    );
  }

  /**
   * @param {ParentNode=} scope
   * @returns {void}
   */
  enhanceInteractiveElements(scope = this.currentScene || this.root) {
    if (!scope) {
      return;
    }

    scope.querySelectorAll('[data-run]').forEach((node) => {
      const element = /** @type {HTMLElement} */ (node);

      if (element.closest('.steps') || element.tagName === 'BUTTON') {
        return;
      }

      if (!element.hasAttribute('tabindex')) {
        element.tabIndex = 0;
      }

      if (!element.hasAttribute('role')) {
        element.setAttribute('role', 'button');
      }
    });
  }

  /**
   * @param {string | undefined} hexColor
   * @returns {void}
   */
  applyDialogColor(hexColor) {
    const color = parseHexColor(hexColor);

    if (!color) {
      this.dialogPanel.style.removeProperty('--dialog-border-color');
      this.dialogPanel.style.removeProperty('--dialog-bg-top');
      this.dialogPanel.style.removeProperty('--dialog-bg-bottom');
      this.dialogPanel.style.removeProperty('--speaker-bg');
      this.dialogPanel.style.removeProperty('--speaker-text');
      return;
    }

    const border = mixColors(color, { r: 24, g: 32, b: 38 }, 0.18);
    const backgroundTop = mixColors(color, { r: 255, g: 255, b: 255 }, 0.9);
    const backgroundBottom = mixColors(color, { r: 245, g: 232, b: 214 }, 0.82);
    const speakerBackground = mixColors(
      color,
      { r: 255, g: 255, b: 255 },
      0.78,
    );
    const speakerText = mixColors(color, { r: 24, g: 32, b: 38 }, 0.35);

    this.dialogPanel.style.setProperty(
      '--dialog-border-color',
      rgbString(border),
    );
    this.dialogPanel.style.setProperty(
      '--dialog-bg-top',
      rgbString(backgroundTop, 0.96),
    );
    this.dialogPanel.style.setProperty(
      '--dialog-bg-bottom',
      rgbString(backgroundBottom, 0.98),
    );
    this.dialogPanel.style.setProperty(
      '--speaker-bg',
      rgbString(speakerBackground, 0.9),
    );
    this.dialogPanel.style.setProperty(
      '--speaker-text',
      rgbString(speakerText),
    );
  }

  /**
   * @param {string | undefined} speaker
   * @param {string} text
   * @param {string=} hexColor
   * @returns {void}
   */
  setDialog(speaker, text, hexColor) {
    this.speakerName.textContent = speaker || '';
    this.dialogText.textContent = text || '';
    this.speakerName.classList.toggle('is-hidden', !speaker);
    this.applyDialogColor(hexColor);
  }

  /**
   * @param {string} selector
   * @returns {void}
   */
  setActiveCharacter(selector) {
    if (!this.currentScene) {
      return;
    }

    this.currentScene.querySelectorAll('[data-char]').forEach((node) => {
      const character = /** @type {HTMLElement} */ (node);
      character.classList.remove('active');
    });

    if (!selector) {
      return;
    }

    const activeCharacter = this.currentScene.querySelector(selector);

    if (activeCharacter) {
      activeCharacter.classList.add('active');
    }
  }

  /**
   * @param {string | undefined} selector
   * @returns {void}
   */
  showElement(selector) {
    if (!this.currentScene || !selector) {
      return;
    }

    const element = this.currentScene.querySelector(selector);

    if (element) {
      element.classList.remove('is-hidden');
    }
  }

  /**
   * @param {string | undefined} selector
   * @returns {void}
   */
  hideElement(selector) {
    if (!this.currentScene || !selector) {
      return;
    }

    const element = this.currentScene.querySelector(selector);

    if (element) {
      element.classList.add('is-hidden');
      element.classList.remove('active');
    }
  }

  /**
   * @param {string} conditionName
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  evaluateCondition(conditionName, element) {
    const condition = this.conditions[conditionName];

    if (typeof condition !== 'function') {
      console.warn(`Condition "${conditionName}" was not found.`);
      return false;
    }

    return Boolean(condition(this, { element }));
  }

  /**
   * @param {HTMLElement} element
   * @returns {void}
   */
  updateConditionalElement(element) {
    const visibleIf = element.dataset.visibleIf;
    const visibleIfNot = element.dataset.visibleIfNot;
    let isVisible = true;

    if (visibleIf) {
      isVisible = isVisible && this.evaluateCondition(visibleIf, element);
    }

    if (visibleIfNot) {
      isVisible = isVisible && !this.evaluateCondition(visibleIfNot, element);
    }

    element.classList.toggle('is-hidden', !isVisible);
  }

  /**
   * @param {ParentNode=} scope
   * @returns {void}
   */
  refreshConditionalElements(scope = this.currentScene || this.root) {
    if (!scope) {
      return;
    }

    this.enhanceInteractiveElements(scope);

    scope
      .querySelectorAll('[data-visible-if], [data-visible-if-not]')
      .forEach((node) => {
        const element = /** @type {HTMLElement} */ (node);
        this.updateConditionalElement(element);
      });
  }

  /**
   * @param {string | undefined} selector
   * @param {string | undefined} src
   * @param {number} token
   * @param {string | undefined} duration
   * @returns {boolean}
   */
  swapImage(selector, src, token, duration) {
    if (!this.currentScene || !selector || !src) {
      return false;
    }

    const element = /** @type {HTMLImageElement | null} */ (
      this.currentScene.querySelector(selector)
    );
    const fadeDuration = Number(duration || 220);
    const preload = this.preloadImage(src);

    if (!element || element.tagName !== 'IMG' || !preload) {
      return false;
    }

    const startSwap = () => {
      const clone = /** @type {HTMLImageElement} */ (element.cloneNode(false));
      const previousTransitionDuration = element.style.transitionDuration;

      clone.removeAttribute('data-char');
      clone.removeAttribute('data-item');
      clone.classList.remove('active');
      clone.classList.add('is-swap-clone');
      clone.style.transitionDuration = `${fadeDuration}ms`;
      element.style.transitionDuration = `${fadeDuration}ms`;

      element.classList.add('is-swapping');
      element.insertAdjacentElement('afterend', clone);
      element.src = src;

      clone.offsetWidth;

      window.requestAnimationFrame(() => {
        if (token !== this.flowToken) {
          element.style.transitionDuration = previousTransitionDuration;
          clone.remove();
          return;
        }

        window.requestAnimationFrame(() => {
          if (token !== this.flowToken) {
            element.style.transitionDuration = previousTransitionDuration;
            clone.remove();
            return;
          }

          clone.classList.add('is-swapping');
          element.classList.remove('is-swapping');
        });
      });

      window.setTimeout(() => {
        clone.remove();
        element.style.transitionDuration = previousTransitionDuration;

        if (token === this.flowToken) {
          this.continueScene(token);
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
  }

  /** @returns {void} */
  updateDebugPanel() {
    if (this.debugScene) {
      this.debugScene.textContent = this.currentScene
        ? this.currentScene.id
        : 'none';
    }

    if (this.stateOutput) {
      this.stateOutput.textContent = JSON.stringify(this.state, null, 2);
    }
  }

  /** @returns {void} */
  syncStoryUiVisibility() {
    const hideStoryUi = this.currentScene?.dataset.hideStoryUi === 'true';
    this.storyUi.classList.toggle('is-hidden', hideStoryUi);
  }

  /** @returns {void} */
  stopAllAudio() {
    this.audioElements.forEach((sound) => {
      sound.pause();
      sound.currentTime = 0;
    });
  }

  /**
   * @param {string} id
   * @returns {HTMLAudioElement | null}
   */
  playAudio(id) {
    const sound = /** @type {HTMLAudioElement | null} */ (
      document.getElementById(id)
    );

    if (!sound) {
      return null;
    }

    this.stopAllAudio();
    sound.play().catch(function () {
      return null;
    });
    return sound;
  }

  /**
   * @param {string} actionName
   * @param {EngineActionDetails=} details
   * @returns {string | void | null}
   */
  runAction(actionName, details = {}) {
    const action = this.actions[actionName];

    if (typeof action !== 'function') {
      console.warn(`Action "${actionName}" was not found.`);
      return null;
    }

    return action(this, details);
  }

  /**
   * @param {string} sceneId
   * @returns {void}
   */
  goTo(sceneId) {
    const nextScene = /** @type {HTMLElement | null} */ (
      this.root.querySelector(`#${sceneId}`)
    );

    if (!nextScene) {
      console.warn(`Scene "${sceneId}" was not found.`);
      return;
    }

    this.flowToken += 1;
    this.waitingForClick = false;
    this.clearActions();

    this.root.querySelectorAll('.scene').forEach((node) => {
      const scene = /** @type {HTMLElement} */ (node);
      scene.classList.remove('is-active');
    });

    nextScene.classList.add('is-active');
    this.currentScene = nextScene;
    this.currentSteps = Array.from(
      nextScene.querySelectorAll('.steps [data-step]'),
    ).map(function (node) {
      return /** @type {HTMLElement} */ (node);
    });
    this.stepIndex = 0;
    this.syncStoryUiVisibility();
    this.refreshConditionalElements(nextScene);
    this.updateDebugPanel();
    this.continueScene(this.flowToken);
  }

  /**
   * @param {number} token
   * @returns {void}
   */
  continueScene(token) {
    if (token !== this.flowToken || !this.currentScene) {
      return;
    }

    while (this.stepIndex < this.currentSteps.length) {
      const step = this.currentSteps[this.stepIndex];
      this.stepIndex += 1;

      const outcome = this.executeStep(step, token);

      if (outcome === 'pause' || outcome === 'scene-changed') {
        return;
      }
    }

    this.clearActions();
  }

  /**
   * @param {HTMLElement} step
   * @param {number} token
   * @returns {StepOutcome}
   */
  executeStep(step, token) {
    const stepType = step.dataset.step;

    switch (stepType) {
      case 'say':
        this.setDialog(
          step.dataset.speaker,
          step.textContent.trim(),
          step.dataset.color,
        );
        return 'continue';

      case 'focus':
        this.setActiveCharacter(step.dataset.target || '');
        return 'continue';

      case 'show':
        this.showElement(step.dataset.target);
        return 'continue';

      case 'hide':
        this.hideElement(step.dataset.target);
        return 'continue';

      case 'refresh':
        this.refreshConditionalElements();
        return 'continue';

      case 'swap-image':
        return this.swapImage(
          step.dataset.target,
          step.dataset.src,
          token,
          step.dataset.duration,
        )
          ? 'pause'
          : 'continue';

      case 'run': {
        if (!step.dataset.action) {
          return 'continue';
        }

        const actionResult = this.runAction(step.dataset.action, { step });

        if (typeof actionResult === 'string') {
          this.goTo(actionResult);
          return 'scene-changed';
        }

        if (token !== this.flowToken) {
          return 'scene-changed';
        }

        return 'continue';
      }

      case 'goto':
        if (!step.dataset.scene) {
          return 'continue';
        }

        this.goTo(step.dataset.scene);
        return 'scene-changed';

      case 'wait-click':
        this.clearChoices();
        this.waitingForClick = true;
        this.showContinueButton();
        return 'pause';

      case 'wait-ms':
        window.setTimeout(
          () => {
            if (token === this.flowToken) {
              this.continueScene(token);
            }
          },
          Number(step.dataset.ms || 0),
        );
        return 'pause';

      case 'choice':
        this.renderChoices(step, token);
        return 'pause';

      default:
        console.warn(`Step type "${stepType}" is not supported.`);
        return 'continue';
    }
  }

  /**
   * @param {HTMLElement} step
   * @param {number} token
   * @returns {void}
   */
  renderChoices(step, token) {
    this.clearActions();

    Array.from(step.querySelectorAll('button')).forEach((node) => {
      const templateButton = /** @type {HTMLButtonElement} */ (node);
      this.choiceList.appendChild(
        this.createChoiceButton(templateButton, step, token),
      );
    });
  }
}
export default VisualNovelEngine;
