# Level 4 Visual Novel Engine

This is a first version of a small HTML/CSS/JavaScript visual novel engine built from `SPEC.md`.

It is intentionally simple:

- Scenes are regular `<section>` elements in `index.html`
- Story flow is driven by `data-step` elements inside each scene
- Global game state lives in one JavaScript object
- Branching logic stays in JavaScript actions, not in HTML

## Files

- `index.html`: scene markup, step markup, and the sample story
- `styles.css`: layout, visual styling, and character highlighting
- `scripts/engine.js`: core engine logic
- `scripts/story.js`: story-specific actions and ending logic
- `assets/images/`: flat SVG backgrounds and characters with simple text labels
- `assets/audio/`: two small WAV tones used by the sample

## Supported step types

- `say`: update the dialog box text and speaker label; optional `data-color="#hex"` rethemes the dialog box for that line
- `focus`: mark one character as active using `data-target`; use an empty target to clear focus
- `show`: show an element in the current scene
- `hide`: hide an element in the current scene
- `swap-image`: crossfade from the current image to a new `src`; swap targets are preloaded on startup
- `run`: call a JavaScript action
- `goto`: switch to another scene
- `wait-click`: pause until the player presses Continue
- `wait-ms`: pause for a number of milliseconds
- `choice`: render buttons and wait for a selection

## Example scene

```html
<section class="scene" id="intro-scene">
  <img class="scene-background" src="assets/images/bg-campus.svg">
  <img class="character is-hidden" data-char="ava" src="assets/images/char-ava.svg">

  <div class="steps">
    <div data-step="show" data-target='[data-char="ava"]'></div>
    <div data-step="focus" data-target='[data-char="ava"]'></div>
    <div
      data-step="swap-image"
      data-target='[data-char="ava"]'
      data-src="assets/images/characters/char-ava-happy.png"
      data-duration="220"
    ></div>
    <div data-step="say" data-speaker="Ava" data-color="#d96d3f">
      The radio should be silent by now.
    </div>
    <div data-step="focus" data-target=""></div>
    <div data-step="wait-click"></div>
    <div data-step="choice">
      <button type="button" data-run="chooseSignal" data-next="lab-scene">Trace the signal</button>
      <button type="button" data-run="chooseRoof" data-next="rooftop-scene">Go to the roof</button>
    </div>
  </div>
</section>
```

## Example action

```js
engine.actions.checkEnding = function (game) {
  if (game.state.investigatedSignal && game.state.hasKeycard) {
    return "clear-ending-scene";
  }

  return "storm-ending-scene";
};
```

## Run it

Open `index.html` in a browser.

For teaching, students can usually stay in three places:

- `index.html` to add scenes, steps, and choices
- `styles.css` to restyle the UI
- `scripts/story.js` to add variables, functions, and ending logic
