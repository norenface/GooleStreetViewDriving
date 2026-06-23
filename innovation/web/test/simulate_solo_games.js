// Plays full random-vs-Ruling-Party SoloPlay games through the real
// engine/effects/soloplay pipeline to shake out crashes. Not a correctness
// oracle for the source PDF's exact rules text (see soloplay.js header for
// documented simplifications), but it exercises RP's turn loop, the culture
// track / line-crossing demand resolution, the score-pile achieve cost, and
// end-game scoring across many random games.
var engine = require('../js/engine.js');
var cardsDb = require('../js/cards.js');
var effects = require('../js/effects.js')(engine);
var soloplay = require('../js/soloplay.js')(engine, effects);
var randomController = require('../js/controllers/randomController.js');
var soloBotController = require('../js/controllers/soloBotController.js');

async function playOne(maxTurns) {
  var game = soloplay.makeSoloGame(cardsDb, 'P0');
  game.players[0].controller = randomController.makeRandomController();
  game.players[1].controller = soloBotController.makeSoloBotController(cardsDb);
  await soloplay.playSoloGame(game, { maxTurns: maxTurns });
  return game;
}

async function main() {
  var games = parseInt(process.argv[2] || '20', 10);
  var maxTurns = parseInt(process.argv[3] || '300', 10);
  var failures = 0;
  for (var i = 0; i < games; i++) {
    try {
      var game = await playOne(maxTurns);
      var r = game.soloResult;
      var status = r ? (r.victory ? 'VICTORY (' + r.humanTotal + ' vs goal ' + r.goalTotal + ', culture ' + r.cultureRating + ' ' + r.cultureName + ')'
        : 'loss (' + r.humanTotal + ' vs goal ' + r.goalTotal + ')') : 'no result computed';
      console.log('solo game ' + i + ': ' + status + ', turn=' + game.turn + ', endReason=' + game.endReason);
    } catch (e) {
      failures++;
      console.error('solo game ' + i + ' CRASHED: ' + e.stack);
    }
  }
  console.log(failures === 0 ? ('OK: ' + games + ' simulated solo games completed without crashing.') : (failures + ' / ' + games + ' solo games crashed.'));
  process.exit(failures === 0 ? 0 : 1);
}

main();
