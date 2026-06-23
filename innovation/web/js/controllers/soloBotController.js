// The "Ruling Party" controller for the SoloPlay variant (see js/soloplay.js).
//
// Resolves the handful of sub-choices that can still reach RP during dogma
// sharing/demands (chooseCard/chooseColor/choosePlayer/confirm) with a single
// greedy heuristic - RP always tries to maximize its own score-pile/hand
// value (the two are equivalent for RP, see soloplay.js) - which happens to
// reproduce most of the source PDF's per-card "No action" / "only if it
// increases the score pile" clarifications for free, since those are exactly
// what this heuristic already does on optional/give-away choices.
//
// chooseSplay always declines: the source rule states the Ruling Party never
// splays its stacks. chooseAction is unused (soloplay.js drives RP's turns
// directly) but implemented defensively in case it's ever invoked.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationSoloBotController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeSoloBotController(cardsDb) {
    var byId = {};
    cardsDb.forEach(function (c) { byId[c.id] = c; });

    function worth(id) { return byId[id].age; }

    function sortByWorth(ids, dir) {
      var copy = ids.slice();
      copy.sort(function (a, b) {
        var d = worth(a) - worth(b);
        return dir === 'max' ? -d : d;
      });
      return copy;
    }

    // True if the prompt reads as "you are giving this card away" (pick the
    // least valuable candidate, or none if optional); false if it reads as
    // "you get to keep/meld/score this" (pick the most valuable).
    function isGiveAwayPrompt(prompt) {
      if (!prompt) return false;
      return /Return|Transfer|Give your/i.test(prompt) && !/draw and (meld|score)|to draw/i.test(prompt);
    }

    return {
      async chooseAction(player, ctx) {
        return (ctx.legal && ctx.legal[0]) || { type: 'draw' };
      },

      async chooseCard(player, opts) {
        var ids = opts.ids || [];
        if (!ids.length) return [];
        var min = opts.min || 0, max = opts.max == null ? ids.length : opts.max;
        var giveAway = isGiveAwayPrompt(opts.prompt);
        var sorted = sortByWorth(ids, giveAway ? 'min' : 'max');
        var count = giveAway ? min : max;
        count = Math.max(min, Math.min(max, count));
        return sorted.slice(0, count);
      },

      async chooseColor(player, opts) {
        var colors = opts.colors || [];
        if (!colors.length) return null;
        if (opts.optional) return null; // RP declines optional color choices (no benefit to itself)
        var giveAway = /Transfer|least-represented/i.test(opts.prompt || '');
        var best = null, bestScore = giveAway ? Infinity : -Infinity;
        colors.forEach(function (c) {
          var score = player.board[c].cards.length;
          if (giveAway ? score < bestScore : score > bestScore) { bestScore = score; best = c; }
        });
        return best || colors[0];
      },

      async choosePlayer(player, opts) {
        var ids = opts.ids || [];
        return ids.length ? ids[0] : null;
      },

      async chooseSplay(player, opts) {
        return null; // the Ruling Party never splays its stacks
      },

      async confirm(player, prompt) {
        return true; // greedy default; matches "maximize own score pile" heuristic
      }
    };
  }

  return { makeSoloBotController: makeSoloBotController };
});
