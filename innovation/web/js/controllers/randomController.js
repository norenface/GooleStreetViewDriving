// A controller that makes uniformly random legal choices. Used for automated
// engine testing/simulation and as a trivial fallback opponent.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationRandomController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function makeRandomController() {
    return {
      async chooseAction(player, ctx) {
        return pick(ctx.legal);
      },
      async chooseCard(player, opts) {
        var min = opts.min || 0, max = opts.max == null ? opts.ids.length : opts.max;
        if (!opts.ids.length) return [];
        var n = Math.min(opts.ids.length, min + Math.floor(Math.random() * (max - min + 1)));
        var pool = opts.ids.slice();
        var out = [];
        for (var i = 0; i < n; i++) {
          var idx = Math.floor(Math.random() * pool.length);
          out.push(pool.splice(idx, 1)[0]);
        }
        return out;
      },
      async chooseColor(player, opts) {
        if (!opts.colors.length) return null;
        if (opts.optional && Math.random() < 0.3) return null;
        return pick(opts.colors);
      },
      async choosePlayer(player, opts) {
        return pick(opts.ids);
      },
      async chooseSplay(player, opts) {
        if (!opts.options.length) return null;
        if (opts.optional && Math.random() < 0.3) return null;
        return pick(opts.options);
      },
      async confirm(player, prompt) {
        return Math.random() < 0.5;
      }
    };
  }

  return { makeRandomController: makeRandomController };
});
