// Bootstraps a browser game of Innovation: builds the setup screen (player
// count + opponent type per seat), wires up HumanController for seat 0 and
// AIController/RandomController for the rest, then drives the game via
// flow.playFullGame with an onAction hook that re-renders the board after
// every single action (not just once per turn) so the human can watch AI/
// random opponents play out their moves.
(function () {
  'use strict';

  var engine = window.Innovation;
  var cardsDb = window.InnovationCards;
  var effects = window.InnovationEffects(engine);
  var flow = window.InnovationFlow(engine, effects);
  var ui = window.InnovationUI.makeUI(engine, cardsDb);

  var HUMAN_SEAT = 0;

  var setupScreen = document.getElementById('setup-screen');
  var gameScreen = document.getElementById('game-screen');
  var playerCountSelect = document.getElementById('player-count');
  var opponentRows = document.getElementById('opponent-rows');
  var startBtn = document.getElementById('start-game-btn');

  function renderOpponentRows() {
    var n = parseInt(playerCountSelect.value, 10);
    opponentRows.innerHTML = '';
    for (var i = 1; i < n; i++) {
      var row = document.createElement('div');
      row.className = 'opponent-row';
      var label = document.createElement('span');
      label.textContent = 'Player ' + (i + 1);
      var select = document.createElement('select');
      select.dataset.seat = i;
      ['ai', 'random'].forEach(function (kind) {
        var opt = document.createElement('option');
        opt.value = kind;
        opt.textContent = kind === 'ai' ? 'CPU (smart)' : 'CPU (random)';
        select.appendChild(opt);
      });
      row.appendChild(label);
      row.appendChild(select);
      opponentRows.appendChild(row);
    }
  }

  playerCountSelect.addEventListener('change', renderOpponentRows);
  renderOpponentRows();

  startBtn.addEventListener('click', function () {
    var n = parseInt(playerCountSelect.value, 10);
    var specs = [{ name: 'You', kind: 'human' }];
    var opponentKinds = [];
    opponentRows.querySelectorAll('select').forEach(function (sel) {
      opponentKinds.push(sel.value);
    });
    for (var i = 1; i < n; i++) {
      var kind = opponentKinds[i - 1] || 'ai';
      specs.push({ name: 'CPU ' + i + (kind === 'random' ? ' (random)' : ''), kind: 'ai' });
    }

    var game = engine.createGame(cardsDb, specs);
    ui.setHumanPlayer(HUMAN_SEAT);
    game.players[HUMAN_SEAT].controller = window.InnovationHumanController.makeHumanController(ui);
    for (var p = 1; p < n; p++) {
      var k = opponentKinds[p - 1] || 'ai';
      game.players[p].controller = k === 'ai'
        ? window.InnovationAIController.makeAIController(engine, cardsDb, effects)
        : window.InnovationRandomController.makeRandomController();
    }

    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    flow.playFullGame(game, {
      maxTurns: 1500,
      onAction: function (g) { ui.render(g); }
    }).then(function (finishedGame) {
      ui.render(finishedGame);
      ui.showGameOver(finishedGame);
    }).catch(function (err) {
      console.error(err);
      ui.render(game);
      var banner = document.getElementById('game-over-banner');
      banner.textContent = 'An error occurred: ' + err.message;
      banner.classList.remove('hidden');
    });
  });
})();
