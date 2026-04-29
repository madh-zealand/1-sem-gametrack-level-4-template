# Level 4 Visual Novel Engine

Small HTML/CSS/JavaScript visual novel engine for building branching story games directly in the DOM.

The engine is intentionally simple:

- scenes are regular `<section>` elements in `index.html`
- story flow is driven by `data-step` elements inside each scene
- game state lives in one JavaScript object
- branching logic stays in JavaScript actions and conditions
- styling stays in CSS

This repo already contains a working sample game. To build your own, you mainly work in:

- `index.html`
- `styles.css`
- `scripts/story.js`

## Project structure

- `index.html`: scene markup, step markup, UI structure, and audio elements
- `styles.css`: layout, dialog UI, scene presentation, and interactive styling
- `scripts/engine.js`: reusable engine runtime
- `scripts/story.js`: story-specific state, conditions, and actions
- `assets/images/`: backgrounds, characters, and item images
- `assets/audio/`: music, transitions, click SFX, pickup SFX, and optional voice lines
- `SPEC.md`: project goals and engine scope

## How the engine works

Each scene contains:

- a background image
- optional character and item elements
- a `.steps` container with story steps

Only one scene is active at a time.

The engine runs steps in order until it hits a pause:

- `wait-click`
- `wait-ms`
- `choice`
- `swap-image` while the image crossfade is still running
- `goto` or `run` when they change scene

Everything else runs immediately in sequence.

## Minimal setup

At minimum, your HTML needs:

```html
<section class="scene" id="intro-scene">
  <img class="scene-background" src="assets/images/scenes/scene-room.png">

  <div class="steps">
    <div data-step="say" data-speaker="Maya" data-color="#7c9cf5">
      Something is wrong here.
    </div>
    <div data-step="wait-click"></div>
    <div data-step="goto" data-scene="next-scene"></div>
  </div>
</section>
```

And your JavaScript needs to boot the engine:

```js
import { VisualNovelEngine } from "./engine.js";

VisualNovelEngine.boot({
  startSceneId: "intro-scene",
  initialState: {},
  conditions: {},
  actions: {}
});
```

## Supported step types

These are the step types currently implemented in `scripts/engine.js`.

### `say`

Shows dialog text and updates the speaker label.

Attributes:

- `data-speaker`: speaker name
- `data-color`: optional hex color for dialog theming

Example:

```html
<div data-step="say" data-speaker="Ava" data-color="#d96d3f">
  The radio should be silent by now.
</div>
```

### `focus`

Marks one character as active by selector.

Attributes:

- `data-target`: CSS selector inside the current scene

Example:

```html
<div data-step="focus" data-target='[data-char="ava"]'></div>
```

Use an empty target to clear focus:

```html
<div data-step="focus" data-target=""></div>
```

### `show`

Removes `.is-hidden` from a matching element in the current scene.

Attributes:

- `data-target`: CSS selector inside the current scene

Example:

```html
<div data-step="show" data-target='[data-char="ava"]'></div>
```

### `hide`

Adds `.is-hidden` to a matching element in the current scene.

Attributes:

- `data-target`: CSS selector inside the current scene

Example:

```html
<div data-step="hide" data-target='[data-item="radio"]'></div>
```

### `refresh`

Re-evaluates conditional elements in the current scene.

Use this when a previous action or DOM change should immediately affect
elements using `data-visible-if` or `data-visible-if-not`.

Example:

```html
<div data-step="refresh"></div>
```

### `swap-image`

Crossfades an image to a new `src`.

Attributes:

- `data-target`: CSS selector for the target `<img>`
- `data-src`: new image path
- `data-duration`: optional fade time in milliseconds

Example:

```html
<div
  data-step="swap-image"
  data-target='[data-char="ava"]'
  data-src="assets/images/characters/char-ava-happy.png"
  data-duration="220"
></div>
```

### `run`

Calls a JavaScript action from `scripts/story.js`.

Attributes:

- `data-action`: action name

Example:

```html
<div data-step="run" data-action="unlockDoor"></div>
```

If the action returns a scene id string, the engine changes scene.

### `goto`

Changes to another scene directly.

Attributes:

- `data-scene`: target scene id

Example:

```html
<div data-step="goto" data-scene="hallway-scene"></div>
```

### `wait-click`

Pauses the step flow and waits for the player to press `Continue`.

Example:

```html
<div data-step="wait-click"></div>
```

### `wait-ms`

Pauses the step flow for a fixed time.

Attributes:

- `data-ms`: delay in milliseconds

Example:

```html
<div data-step="wait-ms" data-ms="600"></div>
```

### `choice`

Builds choice buttons from the buttons inside the step and pauses until one is picked.

Each button can use:

- `data-run`: optional action name
- `data-next`: optional scene id

Example:

```html
<div data-step="choice">
  <button type="button" data-run="chooseSignal" data-next="lab-scene">
    Trace the signal
  </button>
  <button type="button" data-run="chooseRoof" data-next="roof-scene">
    Go to the roof
  </button>
</div>
```

## Scene attributes

Scenes can also define audio behavior on the scene element itself.

### `data-music`

Starts looping background music when the scene becomes active.

```html
<section class="scene" id="garden-scene" data-music="music-forest">
```

### `data-transition-sound`

Plays a one-shot transition sound when the scene becomes active.

```html
<section
  class="scene"
  id="ending-bad-scene"
  data-music="music-game-over-bad"
  data-transition-sound="transition-glitch"
>
```

### `data-hide-story-ui`

Hides the regular story UI, useful for full-screen ending scenes.

```html
<section class="scene" id="ending-good-scene" data-hide-story-ui="true">
```

## Interactive scene elements

Any scene element can become interactive with `data-run`.

Example:

```html
<img
  class="item"
  data-item="mug"
  data-run="inspectMug"
  data-visible-if="shouldShowMug"
  src="assets/images/items/item-mug.png"
>
```

Supported attributes:

- `data-run="actionName"`: calls a story action when clicked
- `data-next="scene-id"`: optionally change scene after the action
- `data-visible-if="conditionName"`: show only when the condition returns `true`
- `data-visible-if-not="conditionName"`: hide when the condition returns `true`

Notes:

- non-button elements with `data-run` automatically get keyboard accessibility
- conditional selectors are re-evaluated when state changes via `game.setState(...)`

## Writing story state

All story-specific state belongs in `scripts/story.js`.

Example:

```js
const storyInitialState = {
  pickedUpMug: false,
  trust: 0,
  ending: null
};
```

Inside actions, use `game.setState(...)` instead of mutating state directly.

```js
game.setState({
  pickedUpMug: true,
  trust: game.state.trust + 1
});
```

## Writing conditions

Conditions are functions used by `data-visible-if` and `data-visible-if-not`.

Example:

```js
const storyConditions = {
  shouldShowMug(game) {
    return !game.state.pickedUpMug;
  },

  canOpenDoor(game) {
    return game.state.trust >= 2;
  }
};
```

## Writing actions

Actions are functions that HTML can trigger from `data-run` or `data-step="run"`.

Example:

```js
const storyActions = {
  inspectMug(game) {
    if (game.state.pickedUpMug) {
      game.setDialog("Ava", "You already checked the mug.", "#d96d3f");
      return;
    }

    game.playSfx("sfx-pickup");
    game.setState({
      pickedUpMug: true
    });
    game.setDialog("Ava", "There is lipstick on the rim.", "#d96d3f");
  },

  checkEnding(game) {
    const endingSceneId =
      game.state.pickedUpMug && game.state.trust >= 2
        ? "good-ending-scene"
        : "bad-ending-scene";

    game.setState({
      ending: endingSceneId === "good-ending-scene" ? "good" : "bad"
    });

    return endingSceneId;
  }
};
```

Actions can:

- read `game.state`
- update state with `game.setState(...)`
- update dialog with `game.setDialog(...)`
- jump to another scene by returning a string scene id
- play music or sound effects
- call other engine helpers

## Useful engine helpers inside actions

These are the helpers you are most likely to use in `scripts/story.js`.

- `game.setState(updates)`: merge new state values
- `game.resetState()`: restore initial state
- `game.setDialog(speaker, text, color)`: update the dialog box manually
- `game.goTo(sceneId)`: change scene directly
- `game.playMusic(id)`: start looping music
- `game.playSfx(id)`: play a one-shot sound
- `game.stopMusic()`: stop current looping music
- `game.stopAllAudio()`: stop everything
- `game.showElement(selector)`: show an element in the current scene
- `game.hideElement(selector)`: hide an element in the current scene
- `game.refreshConditionalElements()`: refresh conditional visibility

## Audio setup

Audio elements live in `index.html` and are referenced by id.

Example:

```html
<audio id="music-forest" preload="auto" src="assets/audio/music-forest.mp3"></audio>
<audio id="transition-soft" preload="auto" src="assets/audio/transition-soft.mp3"></audio>
<audio id="sfx-click" preload="auto" src="assets/audio/sfx-click.mp3"></audio>
<audio id="voice-ava-warning" preload="auto" src="assets/audio/voice-ava-warning.mp3"></audio>
```

Current engine behavior:

- scene music loops
- transition sounds are one-shot
- button clicks use `sfx-click`
- item and story-specific sounds should be triggered from actions
- first-scene music may wait until the first user interaction because of browser autoplay rules

## Complete example scene

```html
<section
  class="scene"
  id="intro-scene"
  data-music="music-peaceful-piano"
  data-transition-sound="transition-soft"
>
  <img
    class="scene-background"
    src="assets/images/scenes/scene-living-room.png"
  >
  <img
    class="character is-hidden"
    data-char="ava"
    src="assets/images/characters/char-ava-neutral.png"
  >
  <img
    class="item"
    data-item="mug"
    data-run="inspectMug"
    data-visible-if="shouldShowMug"
    src="assets/images/items/item-mug.png"
  >

  <section class="scene-panel">
    <button class="secondary-button" type="button" data-run="talkToAva">
      Talk to Ava
    </button>
    <button class="primary-button" type="button" data-run="goToHallway">
      Leave room
    </button>
  </section>

  <div class="steps">
    <div data-step="show" data-target='[data-char="ava"]'></div>
    <div data-step="focus" data-target='[data-char="ava"]'></div>
    <div data-step="say" data-speaker="Ava" data-color="#d96d3f">
      We need to decide what happened before anyone leaves.
    </div>
    <div data-step="wait-click"></div>
    <div data-step="choice">
      <button type="button" data-run="supportAva" data-next="hallway-scene">
        Help Ava
      </button>
      <button type="button" data-run="doubtAva" data-next="hallway-scene">
        Question Ava
      </button>
    </div>
  </div>
</section>
```

## Complete example story module

```js
import { VisualNovelEngine } from "./engine.js";

const storyInitialState = {
  pickedUpMug: false,
  trust: 0,
  ending: null
};

const storyConditions = {
  shouldShowMug(game) {
    return !game.state.pickedUpMug;
  }
};

const storyActions = {
  inspectMug(game) {
    if (game.state.pickedUpMug) {
      game.setDialog("Ava", "You already checked the mug.", "#d96d3f");
      return;
    }

    game.playSfx("sfx-pickup");
    game.setState({
      pickedUpMug: true
    });
    game.setDialog("Ava", "There is lipstick on the rim.", "#d96d3f");
  },

  supportAva(game) {
    game.setState({
      trust: game.state.trust + 1
    });
  },

  doubtAva(game) {
    game.setState({
      trust: game.state.trust - 1
    });
  },

  goToHallway(game) {
    if (game.state.trust >= 1) {
      return "hallway-scene";
    }

    game.setDialog("Ava", "Not yet. We still missed something.", "#d96d3f");
  }
};

VisualNovelEngine.boot({
  startSceneId: "intro-scene",
  initialState: storyInitialState,
  conditions: storyConditions,
  actions: storyActions
});
```

## Building your own game

Recommended workflow:

1. Replace the sample story scenes in `index.html`
2. Define your own state object in `scripts/story.js`
3. Add conditions for items, branches, and endings
4. Add actions for choices, interactions, and scene changes
5. Add your own images and audio in `assets/`
6. Test scene flow often

For most student projects, the main work stays in:

- `index.html` for scenes, steps, items, and choices
- `scripts/story.js` for logic and state
- `styles.css` for presentation

## Running the project

Students are expected to run the project from PhpStorm.

Recommended workflow:

1. Open the project folder in PhpStorm
2. Open `index.html`
3. Right-click the file and choose `Open in` browser, or use PhpStorm's browser preview/run option
4. Let PhpStorm serve the project locally

If the browser does not open the game correctly, make sure PhpStorm is serving the file through HTTP and not opening `index.html` directly from disk.

## Notes and limitations

- scenes are authored directly in HTML, not JSON
- conditions live in JavaScript, not inline HTML expressions
- state is in-memory only; there is no save/load system
- there is no built-in typewriter effect or dialogue history
- this engine is meant for learning and small projects, not large-scale content pipelines
