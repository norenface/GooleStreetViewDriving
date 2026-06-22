// A controller that resolves every choice by asking a human player through the
// browser UI. It holds no game logic of its own - it just forwards each
// controller method to the matching `ui.ask*` function (see js/ui.js), which
// renders the appropriate prompt/modal and resolves a Promise once the player
// clicks something.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationHumanController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeHumanController(ui) {
    return {
      async chooseAction(player, ctx) { return ui.askAction(player, ctx); },
      async chooseCard(player, opts) { return ui.askCard(player, opts); },
      async chooseColor(player, opts) { return ui.askColor(player, opts); },
      async choosePlayer(player, opts) { return ui.askPlayer(player, opts); },
      async chooseSplay(player, opts) { return ui.askSplay(player, opts); },
      async confirm(player, prompt) { return ui.askConfirm(player, prompt); }
    };
  }

  return { makeHumanController: makeHumanController };
});
