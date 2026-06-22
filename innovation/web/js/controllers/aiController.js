// A heuristic "vs PC" controller for Innovation.
//
// chooseAction does a one-ply lookahead: it clones the current game state,
// actually plays out each legal action (including resolving any dogma
// sub-choices, using this same controller's heuristics for every player
// involved) on the clone, scores the resulting position, and picks whichever
// action produced the best score. This avoids the trap of cheap proxy
// heuristics (e.g. "pick the dogma with the most icons") that don't track
// what a card's effect actually does.
//
// chooseCard/chooseColor/chooseSplay (used to resolve sub-choices inside a
// dogma effect, both for this player and for opponents during simulation) are
// called without a `game` reference (see effects.js), so card metadata
// (age/icons/color) is looked up from the static card database passed to
// makeAIController rather than from live game state.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationAIController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeAIController(engine, cardsDb, effectDefs) {
    var byId = {};
    cardsDb.forEach(function (c) { byId[c.id] = c; });

    function worth(id) {
      var c = byId[id];
      return c.age * 3 + c.icons.filter(Boolean).length;
    }

    function sortByWorth(ids, dir) {
      var copy = ids.slice();
      copy.sort(function (a, b) {
        var d = worth(a) - worth(b);
        return dir === 'max' ? -d : d;
      });
      return copy;
    }

    // True if the prompt reads as "you are giving this card away / discarding it"
    // (pick the least valuable candidate); false if it reads as "you get to
    // keep/meld/score this" (pick the most valuable one).
    function isGiveAwayPrompt(prompt) {
      if (!prompt) return false;
      return /Return|Transfer|Give your/i.test(prompt) && !/draw and (meld|score)|to draw/i.test(prompt);
    }

    function stackIconCountForDirection(player, color, direction) {
      var cards = player.board[color].cards;
      if (!cards.length) return 0;
      var topIcons = byId[cards[cards.length - 1]].icons.filter(Boolean).length;
      var revealed = 0;
      for (var i = 0; i < cards.length - 1; i++) {
        var ic = byId[cards[i]].icons;
        if (direction === 'left') { if (ic[3]) revealed++; }
        else if (direction === 'right') { if (ic[0]) revealed++; }
        else if (direction === 'up') { revealed += ic.filter(Boolean).length; }
      }
      return topIcons + revealed;
    }

    var self = {
      async chooseAction(player, ctx) {
        var game = ctx.game;
        var candidates = ctx.legal;
        var bestAction = candidates[0] || { type: 'draw' };
        var bestScore = -Infinity;
        for (var i = 0; i < candidates.length; i++) {
          var action = candidates[i];
          var score = await simulateAndScore(game, player.id, action);
          if (score > bestScore) { bestScore = score; bestAction = action; }
        }
        return bestAction;
      },

      async chooseCard(player, opts) {
        var ids = opts.ids || [];
        if (!ids.length) return [];
        var min = opts.min || 0, max = opts.max == null ? ids.length : opts.max;
        var giveAway = isGiveAwayPrompt(opts.prompt);
        var sorted = sortByWorth(ids, giveAway ? 'min' : 'max');

        var anyCount = /any number/i.test(opts.prompt || '');
        var count;
        if (min === max) count = min;
        else if (giveAway) count = anyCount ? Math.min(max, Math.ceil(ids.length / 2)) : min;
        else count = max; // meld/score "any number" with no downside: take as many as offered

        count = Math.max(min, Math.min(max, count));
        return sorted.slice(0, count);
      },

      async chooseColor(player, opts) {
        var colors = opts.colors || [];
        if (!colors.length) return null;
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
        var options = opts.options || [];
        if (!options.length) return null;
        var best = options[0], bestScore = -Infinity;
        options.forEach(function (o) {
          var score = stackIconCountForDirection(player, o.color, o.direction);
          if (o.direction === 'up') score += 0.5; // tiny tie-break preference
          if (score > bestScore) { bestScore = score; best = o; }
        });
        return best;
      },

      async confirm(player, prompt) {
        return true;
      }
    };

    function cloneGame(game) {
      var clone = JSON.parse(JSON.stringify(game, function (key, val) {
        return key === 'controller' ? undefined : val;
      }));
      clone.rng = Math.random;
      clone.players.forEach(function (p) { p.controller = self; });
      return clone;
    }

    async function applyAction(game, player, action) {
      if (action.type === 'draw') {
        engine.drawCard(game, player, engine.highestTopValue(game, player) || 1);
      } else if (action.type === 'meld') {
        engine.meldCard(game, player, action.cardId);
      } else if (action.type === 'dogma') {
        await engine.dogmaAction(game, player, action.color, effectDefs, {});
      } else if (action.type === 'achieve') {
        engine.achieve(game, player, action.age);
      }
    }

    function playerScore(game, p) {
      var icons = 0;
      engine.ICONS.forEach(function (i) { icons += engine.iconCount(game, p, i); });
      return p.achievements.length * 1000 + engine.scoreValue(game, p) * 3 +
        engine.boardCardCount(p) * 2 + icons + p.hand.length * 0.5;
    }

    function evaluate(game, playerId) {
      var mine = playerScore(game, game.players[playerId]);
      var oppBest = 0;
      game.players.forEach(function (o) {
        if (o.id === playerId) return;
        var v = playerScore(game, o);
        if (v > oppBest) oppBest = v;
      });
      return mine - oppBest * 0.5;
    }

    async function simulateAndScore(game, playerId, action) {
      var clone = cloneGame(game);
      var clonedPlayer = clone.players[playerId];
      await applyAction(clone, clonedPlayer, action);
      return evaluate(clone, playerId);
    }

    return self;
  }

  return { makeAIController: makeAIController };
});
