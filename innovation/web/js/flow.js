// Innovation - turn/game flow built on top of engine.js + effects.js.
//
// Implements the official turn structure (rulebook "Starting Play" / "Your Turn"):
//   - Each player draws two age-1 cards; everyone simultaneously melds one of them
//     (the other becomes their starting hand). First player = whoever melded the
//     card alphabetically closest to "A". In a 2p game only the first player gets a
//     single action on their opening turn; in 3p/4p the first two players do.
//   - Every other turn: exactly two actions, in any order, any combination
//     (Draw / Meld / Dogma / Achieve), including the same action twice.
//
// Player actions are decided by player.controller.chooseAction(player, ctx), which
// must resolve to one of:
//   { type: 'draw' }
//   { type: 'meld', cardId }
//   { type: 'dogma', color }            // activates the top card of that color
//   { type: 'achieve', age }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationFlow = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return function (engine, effectDefs) {

    async function setupGame(game) {
      var dealt = game.players.map(function (p) {
        var a = engine.drawCard(game, p, 1);
        var b = engine.drawCard(game, p, 1);
        return { player: p, a: a, b: b };
      });
      for (var i = 0; i < dealt.length; i++) {
        var d = dealt[i];
        var keep = await d.player.controller.chooseCard(d.player, {
          ids: [d.a, d.b], prompt: '最初にメルドするカードを選んでください。', min: 1, max: 1
        });
        var meldId = (keep && keep[0]) || d.a;
        engine.meldCard(game, d.player, meldId, { silent: true });
      }
      // Determine first player: whoever's melded card name is alphabetically closest to "A".
      var firstIdx = 0, firstName = null;
      game.players.forEach(function (p, idx) {
        var color = engine.COLORS.filter(function (c) { return p.board[c].cards.length; })[0];
        var name = color ? engine.card(game, engine.topCard(p, color)).name : '';
        if (firstName === null || name.localeCompare(firstName) < 0) { firstName = name; firstIdx = idx; }
      });
      game.currentPlayer = firstIdx;
      var n = game.players.length;
      game.firstTurnSingleActionFor = {};
      game.firstTurnSingleActionFor[firstIdx] = true;
      if (n === 4) game.firstTurnSingleActionFor[(firstIdx + 1) % n] = true;
      game.log.push(game.players[firstIdx].name + ' が先手です');
    }

    function legalActions(game, player) {
      var allowed = [{ type: 'draw' }];
      player.hand.forEach(function (id) { allowed.push({ type: 'meld', cardId: id }); });
      engine.COLORS.forEach(function (c) {
        if (engine.topCard(player, c) != null) allowed.push({ type: 'dogma', color: c });
      });
      for (var age = 1; age <= 9; age++) {
        if (engine.canAchieve(game, player, age)) allowed.push({ type: 'achieve', age: age });
      }
      return allowed;
    }

    async function performAction(game, player, action) {
      if (game.winner != null) return;
      if (action.type === 'draw') {
        engine.drawCard(game, player, engine.highestTopValue(game, player) || 1);
      } else if (action.type === 'meld') {
        if (player.hand.indexOf(action.cardId) === -1) throw new Error('Illegal meld: card not in hand');
        engine.meldCard(game, player, action.cardId);
      } else if (action.type === 'dogma') {
        if (engine.topCard(player, action.color) == null) throw new Error('Illegal dogma: no top card');
        await engine.dogmaAction(game, player, action.color, effectDefs, {});
      } else if (action.type === 'achieve') {
        if (!engine.canAchieve(game, player, action.age)) throw new Error('Illegal achieve: not eligible');
        engine.achieve(game, player, action.age);
      } else {
        throw new Error('Unknown action type: ' + action.type);
      }
    }

    // Run one full turn for game.currentPlayer (one or two actions per the rules
    // above), then advance to the next player. Returns when the turn is over or the
    // game has ended (game.winner set).
    async function runTurn(game, opts) {
      var player = game.players[game.currentPlayer];
      var actionsThisTurn = (game.firstTurnSingleActionFor && game.firstTurnSingleActionFor[player.id]) ? 1 : 2;
      if (game.firstTurnSingleActionFor) delete game.firstTurnSingleActionFor[player.id];
      for (var i = 0; i < actionsThisTurn; i++) {
        if (game.winner != null) return;
        var ctx = { game: game, player: player, legal: legalActions(game, player) };
        var action = await player.controller.chooseAction(player, ctx);
        await performAction(game, player, action);
        if (opts && opts.onAction) opts.onAction(game);
        if (game.winner != null) return;
      }
      engine.nextPlayer(game);
    }

    // opts.onAction(game), if given, is called after every individual action (draw/meld/
    // dogma/achieve) and once right after setup - lets a UI re-render mid-turn rather than
    // only once a full turn (up to two actions) has completed.
    async function playFullGame(game, opts) {
      opts = opts || {};
      var maxTurns = opts.maxTurns || 10000;
      await setupGame(game);
      if (opts.onAction) opts.onAction(game);
      var turns = 0;
      while (game.winner == null && turns < maxTurns) {
        await runTurn(game, opts);
        turns++;
      }
      return game;
    }

    return {
      setupGame: setupGame,
      legalActions: legalActions,
      performAction: performAction,
      runTurn: runTurn,
      playFullGame: playFullGame
    };
  };
});
