document.addEventListener("DOMContentLoaded", function () {
  var DESIGN_WIDTH = 1440;
  var DESIGN_HEIGHT = 1080;
  var debugPanel = document.querySelector(".debug-panel");
  var viewport = document.querySelector(".viewport");

  if (debugPanel) {
    debugPanel.open = false;
  }

  function updateScale() {
    var scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
    document.documentElement.style.setProperty("--scale", String(scale));

    if (viewport) {
      viewport.style.setProperty("--scale", String(scale));
    }
  }

  var engine = new window.VisualNovelEngine({
    startSceneId: "intro-scene",
    root: document.querySelector(".stage-screen"),
    dialogPanel: document.querySelector(".dialog-panel"),
    dialogText: document.getElementById("dialog-text"),
    speakerName: document.getElementById("speaker-name"),
    choiceList: document.getElementById("choice-list"),
    continueButton: document.getElementById("continue-button"),
    debugScene: document.getElementById("debug-scene"),
    stateOutput: document.getElementById("state-output")
  });

  function resetAudio() {
    document.querySelectorAll("audio").forEach(function (sound) {
      sound.pause();
      sound.currentTime = 0;
    });
  }

  function playSound(id) {
    var sound = document.getElementById(id);

    if (!sound) {
      return;
    }

    resetAudio();
    sound.play().catch(function () {
      return null;
    });
  }

  engine.actions = {
    restartStory: function (game) {
      resetAudio();
      game.resetState();
    },
    packBackpack: function (game) {
      game.state.broughtBackpack = true;
      game.state.travelStyle = "prepared";
      game.updateDebugPanel();
    },
    travelLight: function (game) {
      game.state.broughtBackpack = false;
      game.state.travelStyle = "light";
      game.updateDebugPanel();
    },
    helpAlex: function (game) {
      game.state.helpedAlex = true;
      game.state.recoveredNotepad = true;
      game.updateDebugPanel();
    },
    rushAhead: function (game) {
      game.state.helpedAlex = false;
      game.state.recoveredNotepad = false;
      game.updateDebugPanel();
    },
    checkEnding: function (game) {
      resetAudio();

      if (game.state.broughtBackpack && game.state.helpedAlex) {
        game.state.ending = "good";
        game.updateDebugPanel();
        return "garden-good-ending-scene";
      }

      game.state.ending = "rough";
      game.updateDebugPanel();
      return "garden-bad-ending-scene";
    },
    playSceneTone: function () {
      playSound("sound-lab");
    },
    playEndingTone: function () {
      playSound("sound-ending");
    }
  };

  document.addEventListener("click", function (event) {
    var runButton = event.target.closest("[data-run]");

    if (!runButton) {
      return;
    }

    if (runButton.closest(".steps")) {
      return;
    }

    engine.runAction(runButton.dataset.run, { button: runButton, event: event });

    if (runButton.dataset.next) {
      engine.goTo(runButton.dataset.next);
    }
  });

  window.addEventListener("resize", updateScale);
  updateScale();

  window.game = engine;
  engine.start();
});
