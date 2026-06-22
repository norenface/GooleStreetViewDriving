// Sanity-checks the heuristic AIController: it should run crash-free through the
// full pipeline (like simulate_games.js) and should beat randomController by a
// wide margin across many games and player counts, confirming the one-ply
// lookahead is actually picking better-than-random actions rather than just
// not crashing.
var engine = require('../js/engine.js');
var cardsDb = require('../js/cards.js');
var effects = require('../js/effects.js')(engine);
var flow = require('../js/flow.js')(engine, effects);
var randomController = require('../js/controllers/randomController.js');
var aiController = require('../js/controllers/aiController.js');

async function playOne(numPlayers, maxTurns) {
  var specs = [];
  for (var i = 0; i < numPlayers; i++) specs.push({ name: 'P' + i, kind: 'ai' });
  var game = engine.createGame(cardsDb, specs);
  game.players[0].controller = aiController.makeAIController(engine, cardsDb, effects);
  for (var i = 1; i < numPlayers; i++) game.players[i].controller = randomController.makeRandomController();
  await flow.playFullGame(game, { maxTurns: maxTurns });
  return game;
}

async function main() {
  var games = parseInt(process.argv[2] || '30', 10);
  var maxTurns = parseInt(process.argv[3] || '300', 10);
  var aiWins = 0, otherWins = 0, decided = 0, crashes = 0;
  for (var i = 0; i < games; i++) {
    var numPlayers = 2 + (i % 3);
    try {
      var game = await playOne(numPlayers, maxTurns);
      if (game.winner != null && game.winner !== 'draw') {
        decided++;
        if (game.winner === 0) aiWins++; else otherWins++;
      }
    } catch (e) {
      crashes++;
      console.error('game ' + i + ' (' + numPlayers + 'p) CRASHED: ' + e.stack);
    }
  }
  var winRate = decided ? aiWins / decided : 0;
  console.log('AI ' + aiWins + ' / ' + decided + ' decided games (' + (winRate * 100).toFixed(0) + '%), ' + crashes + ' crashes.');
  var ok = crashes === 0 && winRate >= 0.6;
  console.log(ok ? 'OK: AIController is crash-free and clearly outplays randomController.' : 'FAIL: AIController did not meet the crash/win-rate bar.');
  process.exit(ok ? 0 : 1);
}

main();
