// @ts-check

import { VisualNovelEngine } from "./engine.js";

  /**
   * Single source of truth for story-specific state fields.
   * Add new values here when your story needs to remember something,
   * for example whether the player found a key or talked to a character.
   */
  const storyInitialState = {
    broughtBackpack: false,
    travelStyle: /** @type {string | null} */ (null),
    helpedAlex: false,
    recoveredNotepad: false,
    pickedUpMug: false,
    ending: /** @type {string | null} */ (null)
  };

  /**
   * @typedef {typeof storyInitialState} StoryState
   */

  /**
   * @typedef {Omit<import("./engine.js").VisualNovelEngine, "initialState" | "state" | "setState" | "resetState"> & {
   *   initialState: StoryState,
   *   state: StoryState,
   *   setState: (updates?: Partial<StoryState>) => StoryState,
   *   resetState: () => StoryState
   * }} StoryEngine
   */

  /**
   * @typedef {(game: StoryEngine, details: import("./engine.js").EngineActionDetails) => (string | void | null)} StoryAction
   * @typedef {(game: StoryEngine, context: import("./engine.js").EngineConditionContext) => boolean} StoryCondition
   */

  // Add more story-specific helpers and actions here as the game grows.
  // A condition is used by HTML attributes like `data-visible-if`.
  // Return `true` when an element should be visible, and `false` when it should be hidden.
  /** @type {Record<string, StoryCondition>} */
  const storyConditions = {
    /**
     * @param {StoryEngine} game
     * @returns {boolean}
     */
    shouldShowMug(game) {
      return !game.state.pickedUpMug;
    }
  };

  // `storyActions` is where you add custom JavaScript for your story.
  // Each action is a named function that the HTML can call.
  // Example uses:
  // `data-run="pickUpMug"` on a button or clickable item
  // `<div data-step="run" data-action="checkEnding"></div>` in the story steps
  //
  // Common things an action can do:
  // read story values with `game.state`
  // save new story values with `game.setState({...})`
  // change the dialog with `game.setDialog(...)`
  // play sounds with `game.playAudio(...)`
  // reset the story with `game.resetState()`
  //
  // If an action returns a scene id like `"park-scene"`,
  // the engine will switch to that scene.
  /** @type {Record<string, StoryAction>} */
  const storyActions = {
    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    restartStory(game) {
      game.stopAllAudio();
      game.resetState();
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    packBackpack(game) {
      game.setState({
        broughtBackpack: true,
        travelStyle: "prepared"
      });
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    travelLight(game) {
      game.setState({
        broughtBackpack: false,
        travelStyle: "light"
      });
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    helpAlex(game) {
      game.setState({
        helpedAlex: true,
        recoveredNotepad: true
      });
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    rushAhead(game) {
      game.setState({
        helpedAlex: false,
        recoveredNotepad: false
      });
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    pickUpMug(game) {
      if (game.state.pickedUpMug) {
        return;
      }

      game.setState({
        pickedUpMug: true
      });
      game.setDialog("Abigail", "I should bring the mug too.", "#79b8f9");
    },

    /**
     * @param {StoryEngine} game
     * @returns {string}
     */
    checkEnding(game) {
      const endingSceneId = game.state.broughtBackpack && game.state.helpedAlex
          ? "garden-good-ending-scene"
          : "garden-bad-ending-scene";

      game.stopAllAudio();
      game.setState({
        ending: endingSceneId === "garden-good-ending-scene" ? "good" : "rough"
      });

      return endingSceneId;
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    playSceneTone(game) {
      game.playAudio("sound-lab");
    },

    /**
     * @param {StoryEngine} game
     * @returns {void}
     */
    playEndingTone(game) {
      game.playAudio("sound-ending");
    }
  };

VisualNovelEngine.boot({
  // Change this if you want the story to begin in another scene from index.html.
  startSceneId: "intro-scene",
  initialState: storyInitialState,
  conditions: /** @type {Record<string, import("./engine.js").EngineCondition>} */ (storyConditions),
  actions: /** @type {Record<string, import("./engine.js").EngineAction>} */ (storyActions)
});
