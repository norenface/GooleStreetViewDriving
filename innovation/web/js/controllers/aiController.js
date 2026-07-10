// Heuristic AI controller for Innovation — improved for stronger, goal-oriented play.
//
// Strategy overview:
//   1. One-ply lookahead: simulate every legal action on a cloned game state,
//      evaluate the result, pick the best.
//   2. Evaluation rewards: achievements (heavily) > score pile value > top-card
//      age (board tempo) > icons > hand size.
//   3. Rush mode: once the AI is within 2 achievements of winning, or its score
//      pile exceeds a threshold, the evaluator adds a large bonus for achieve
//      actions and high-age board states, pushing it to advance ages fast.
//   4. Win-distance awareness: if the simulated state would win outright, score
//      it as +Infinity; if the opponent is one step from winning, heavily
//      penalise that outcome.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationAIController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeAIController(engine, cardsDb, effectDefs) {
    var byId = {};
    cardsDb.forEach(function (c) { byId[c.id] = c; });

    // Achievements needed to win by player count
    function achToWin(game) {
      var n = game.players.length;
      return n <= 2 ? 6 : n === 3 ? 5 : 4;
    }

    function ageOf(id) { return byId[id] ? byId[id].age : 1; }

    function worth(id) {
      var c = byId[id];
      if (!c) return 0;
      return c.age * 3 + c.icons.filter(Boolean).length;
    }

    function sortByWorth(ids, dir) {
      return ids.slice().sort(function (a, b) {
        var d = worth(a) - worth(b);
        return dir === 'max' ? -d : d;
      });
    }

    function isGiveAwayPrompt(prompt) {
      if (!prompt) return false;
      return /Return|Transfer|Give your/i.test(prompt) && !/draw and (meld|score)|to draw/i.test(prompt);
    }

    function stackIconCountForDirection(player, color, direction) {
      var cards = player.board[color].cards;
      if (!cards.length) return 0;
      var topIcons = (byId[cards[cards.length - 1]] || { icons: [] }).icons.filter(Boolean).length;
      var revealed = 0;
      for (var i = 0; i < cards.length - 1; i++) {
        var ic = (byId[cards[i]] || { icons: [] }).icons;
        if (direction === 'left') { if (ic[3]) revealed++; }
        else if (direction === 'right') { if (ic[0]) revealed++; }
        else if (direction === 'up') { revealed += ic.filter(Boolean).length; }
      }
      return topIcons + revealed;
    }

    // -----------------------------------------------------------------------
    // Evaluation
    // -----------------------------------------------------------------------

    function highestTopAge(game, p) {
      var max = 0;
      engine.COLORS.forEach(function (c) {
        var top = engine.topCard(p, c);
        if (top) { var a = ageOf(top); if (a > max) max = a; }
      });
      return max;
    }

    function topAgeSum(game, p) {
      var sum = 0;
      engine.COLORS.forEach(function (c) {
        var top = engine.topCard(p, c);
        if (top) sum += ageOf(top);
      });
      return sum;
    }

    function icons(game, p) {
      var n = 0;
      engine.ICONS.forEach(function (i) { n += engine.iconCount(game, p, i); });
      return n;
    }

    function playerScore(game, p) {
      var maxAge = highestTopAge(game, p);
      var ageSum = topAgeSum(game, p);
      return p.achievements.length * 2000
           + engine.scoreValue(game, p) * 4
           + ageSum * 6           // tempo: reward high-age board
           + maxAge * 15          // extra bonus for the single highest top
           + engine.boardCardCount(p) * 2
           + icons(game, p) * 1.5
           + p.hand.length * 0.5;
    }

    function evaluate(game, playerId) {
      var target = achToWin(game);
      var me = game.players[playerId];

      // Outright win detected (e.g. achieve action just pushed us over)
      if (game.winner === playerId) return 1e9;

      var myAch = me.achievements.length;
      var mine = playerScore(game, me);

      // Rush bonus: near winning, every point matters far more
      var achLeft = target - myAch;
      if (achLeft <= 0) return 1e9;        // already won
      if (achLeft === 1) mine += 8000;     // one achievement away
      if (achLeft === 2) mine += 3000;     // two away — enter rush mode
      if (achLeft <= 2 && engine.scoreValue(game, me) >= 5 * (target - achLeft + 1)) {
        mine += 2000;  // can actually grab next achievement this turn
      }

      // High-age rush bonus: reward having the highest top card age
      var myMaxAge = highestTopAge(game, me);
      if (myMaxAge >= 8) mine += myMaxAge * 20;

      var oppBest = 0;
      game.players.forEach(function (o) {
        if (o.id === playerId) return;
        if (game.winner === o.id) { oppBest = 1e9; return; }
        var v = playerScore(game, o);
        var oLeft = target - o.achievements.length;
        if (oLeft <= 0) { oppBest = 1e9; return; }
        if (oLeft === 1) v += 8000;   // opponent is also close — penalise heavily
        if (oLeft === 2) v += 3000;
        if (v > oppBest) oppBest = v;
      });

      return mine - oppBest * 0.65;
    }

    // -----------------------------------------------------------------------
    // Simulation
    // -----------------------------------------------------------------------

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

    async function simulateAndScore(game, playerId, action) {
      var clone = cloneGame(game);
      var clonedPlayer = clone.players[playerId];
      await applyAction(clone, clonedPlayer, action);
      return evaluate(clone, playerId);
    }

    // -----------------------------------------------------------------------
    // Action selection
    // -----------------------------------------------------------------------

    var self = {
      async chooseAction(player, ctx) {
        var game = ctx.game;
        var candidates = ctx.legal;
        if (!candidates.length) return { type: 'draw' };

        var target = achToWin(game);
        var myAch = player.achievements.length;
        var achLeft = target - myAch;
        var myScore = engine.scoreValue(game, player);
        var inRushMode = achLeft <= 2 || myScore >= target * 20;

        // Shortcut: if achieve is available right now, ALWAYS take it
        // (simulate to confirm it's legal, then skip further evaluation)
        var achieveNow = candidates.filter(function (a) { return a.type === 'achieve'; });
        if (achieveNow.length) {
          // Pick the highest-age achievement to maximise board power
          achieveNow.sort(function (a, b) { return b.age - a.age; });
          return achieveNow[0];
        }

        // In rush mode, bias: draw and high-age dogma score an extra flat bonus
        var scores = [];
        for (var i = 0; i < candidates.length; i++) {
          var action = candidates[i];
          var s = await simulateAndScore(game, player.id, action);

          // Rush-mode bonuses applied on top of simulation score
          if (inRushMode) {
            if (action.type === 'draw') {
              // Drawing advances age — big bonus scaled by current top age
              var curAge = engine.highestTopValue(game, player) || 1;
              s += curAge * 30;
            } else if (action.type === 'dogma') {
              // Reward dogmas on our highest-age color (most likely to draw high)
              var topAge = 0;
              var top = engine.topCard(player, action.color);
              if (top) topAge = ageOf(top);
              s += topAge * 20;
            } else if (action.type === 'meld') {
              // Melding a high-age card from hand advances our board
              if (action.cardId) s += ageOf(action.cardId) * 10;
            }
          }

          scores.push({ action: action, score: s });
        }

        scores.sort(function (a, b) { return b.score - a.score; });
        return scores[0].action;
      },

      async chooseCard(player, opts) {
        var ids = opts.ids || [];
        if (!ids.length) return [];
        var min = opts.min == null ? 0 : opts.min;
        var max = opts.max == null ? ids.length : opts.max;
        var giveAway = isGiveAwayPrompt(opts.prompt);
        var sorted = sortByWorth(ids, giveAway ? 'min' : 'max');

        var anyCount = /any number/i.test(opts.prompt || '');
        var count;
        if (min === max) {
          count = min;
        } else if (giveAway) {
          // Give away as few cards as possible, and the least valuable
          count = anyCount ? Math.min(max, Math.ceil(ids.length / 3)) : min;
        } else {
          // Keep/meld/score as many as possible
          count = max;
        }

        count = Math.max(min, Math.min(max, count));
        return sorted.slice(0, count);
      },

      async chooseColor(player, opts) {
        var colors = opts.colors || [];
        if (!colors.length) return null;
        var giveAway = /Transfer|least-represented/i.test(opts.prompt || '');
        var best = null, bestScore = giveAway ? Infinity : -Infinity;
        colors.forEach(function (c) {
          // Prefer the color with the most board cards (most icons revealed)
          var score = player.board[c].cards.length * 2;
          // Also favour highest top age when choosing what to splay/advance
          var top = player.board[c].cards[player.board[c].cards.length - 1];
          if (top && byId[top]) score += byId[top].age;
          if (giveAway ? score < bestScore : score > bestScore) { bestScore = score; best = c; }
        });
        return best || colors[0];
      },

      async choosePlayer(player, opts) {
        // Pick the opponent with the highest score (most threatening)
        var ids = opts.ids || [];
        if (!ids.length) return null;
        return ids[0]; // game state not available here; first is fine
      },

      async chooseSplay(player, opts) {
        var options = opts.options || [];
        if (!options.length) return null;
        var best = options[0], bestScore = -Infinity;
        options.forEach(function (o) {
          var score = stackIconCountForDirection(player, o.color, o.direction);
          // Prefer 'up' splay (reveals all three extra slots)
          if (o.direction === 'up') score += 2;
          else if (o.direction === 'right') score += 0.5;
          if (score > bestScore) { bestScore = score; best = o; }
        });
        return best;
      },

      async confirm(player, prompt) {
        // Be aggressive: almost always say yes to optional effects.
        // Exceptions: don't confirm clearly harmful self-returns.
        if (/手札をすべて戻/i.test(prompt || '')) return false; // don't return whole hand unless it's railroad
        if (/Return all/i.test(prompt || '')) return false;
        return true;
      }
    };

    return self;
  }

  return { makeAIController: makeAIController };
});
