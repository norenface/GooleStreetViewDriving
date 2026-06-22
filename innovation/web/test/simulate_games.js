// Plays full random-vs-random games through the real action/turn/dogma pipeline to
// shake out crashes in engine.js / effects.js / flow.js. Not a correctness oracle for
// exact rules text, but it exercises every card's effect at least a few times across
// many random games and would catch most runtime errors (undefined access, infinite
// loops, illegal-state mutations) before a human ever opens the UI.
var engine = require('../js/engine.js');
var cardsDb = require('../js/cards.js');
var effects = require('../js/effects.js')(engine);
var flow = require('../js/flow.js')(engine, effects);
var randomController = require('../js/controllers/randomController.js');

async function playOne(numPlayers, maxTurns) {
  var specs = [];
  for (var i = 0; i < numPlayers; i++) specs.push({ name: 'P' + i, kind: 'ai' });
  var game = engine.createGame(cardsDb, specs);
  game.players.forEach(function (p) { p.controller = randomController.makeRandomController(); });
  await flow.playFullGame(game, { maxTurns: maxTurns });
  return game;
}

async function main() {
  var games = parseInt(process.argv[2] || '20', 10);
  var maxTurns = parseInt(process.argv[3] || '300', 10);
  var failures = 0;
  for (var i = 0; i < games; i++) {
    var numPlayers = 2 + (i % 3); // cycle through 2,3,4 players
    try {
      var game = await playOne(numPlayers, maxTurns);
      var status = game.winner == null ? 'NO WINNER after ' + maxTurns + ' turns' :
        (game.winner === 'draw' ? 'draw' : game.players[game.winner].name + ' wins (' + game.endReason + ')');
      console.log('game ' + i + ' (' + numPlayers + 'p): ' + status + ', turn=' + game.turn);
    } catch (e) {
      failures++;
      console.error('game ' + i + ' (' + numPlayers + 'p) CRASHED: ' + e.stack);
    }
  }
  console.log(failures === 0 ? ('OK: ' + games + ' simulated games completed without crashing.') : (failures + ' / ' + games + ' games crashed.'));
  process.exit(failures === 0 ? 0 : 1);
}

main();
