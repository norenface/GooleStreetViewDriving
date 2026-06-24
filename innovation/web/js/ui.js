// DOM rendering + human-input layer for Innovation. Pure presentation: it knows
// how to draw a `game` object (from engine.js) into the page and how to turn a
// click into a resolved value for whichever controller method is currently
// being asked (see js/controllers/humanController.js, which just forwards each
// controller call into the matching ui.ask* function below).
//
// Exactly one ask* call is ever pending at a time (the engine/effects pipeline
// is sequential - it always awaits one controller call before issuing the
// next), so a single #modal-overlay / #action-bar pair is reused for every
// prompt rather than stacking multiple UIs.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationUI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ICON_GLYPH = {
    leaf: '🌿', crown: '👑', lightbulb: '💡',
    factory: '🏭', castle: '🏰', clock: '🕰️'
  };
  var ACHIEVEMENT_GLYPH = {
    monument: '🗿', empire: '🎖️', wonder: '✨',
    world: '🌍', universe: '🌌'
  };
  var COLOR_JA = { yellow: '黄', red: '赤', green: '緑', blue: '青', purple: '紫' };
  var DIR_JA = { left: '左', right: '右', up: '上' };
  var KIND_JA = { ai: 'CPU', soloBot: '支配政党', human: '人間' };

  function makeUI(engine, cardsDb) {
    var byId = {};
    cardsDb.forEach(function (c) { byId[c.id] = c; });

    var game = null;
    var humanPlayerId = 0;

    var el = {
      log: document.getElementById('log-panel'),
      players: document.getElementById('players-area'),
      actionBar: document.getElementById('action-bar'),
      modalOverlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body'),
      modalFooter: document.getElementById('modal-footer'),
      gameOver: document.getElementById('game-over-banner')
    };

    function setHumanPlayer(id) { humanPlayerId = id; }

    function iconRow(icons) {
      var row = document.createElement('span');
      row.className = 'icon-row';
      icons.forEach(function (i) {
        var s = document.createElement('span');
        s.className = 'icon-slot' + (i ? '' : ' empty');
        s.textContent = i ? ICON_GLYPH[i] : '';
        row.appendChild(s);
      });
      return row;
    }

    function cardChip(cardId, opts) {
      opts = opts || {};
      var c = byId[cardId];
      var div = document.createElement('div');
      div.className = 'card-chip color-' + c.color + (opts.dim ? ' dim' : '') + (opts.selected ? ' selected' : '');
      var name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = c.name + ' (' + c.age + ')';
      div.appendChild(name);
      div.appendChild(iconRow(c.icons));
      if (opts.onClick) div.addEventListener('click', opts.onClick);
      return div;
    }

    // ---- main board render -------------------------------------------------

    function render(g) {
      game = g;
      renderLog();
      renderPlayers();
    }

    function renderLog() {
      el.log.innerHTML = '';
      game.log.slice(-60).forEach(function (line) {
        var p = document.createElement('div');
        p.className = 'log-line';
        p.textContent = line;
        el.log.appendChild(p);
      });
      el.log.scrollTop = el.log.scrollHeight;
    }

    function renderPlayers() {
      el.players.innerHTML = '';
      game.players.forEach(function (p) {
        var panel = document.createElement('div');
        panel.className = 'player-panel' + (p.id === game.currentPlayer ? ' current' : '');

        var header = document.createElement('div');
        header.className = 'player-header';
        header.textContent = p.name + (p.id === humanPlayerId ? '（あなた）' : '（' + (KIND_JA[p.kind] || p.kind) + '）') +
          ' — 得点 ' + engine.scoreValue(game, p) + '、達成 ' + p.achievements.length;
        panel.appendChild(header);

        if (p.achievements.length) {
          var ach = document.createElement('div');
          ach.className = 'achievement-row';
          p.achievements.forEach(function (a) {
            var s = document.createElement('span');
            s.className = 'achievement-badge';
            s.textContent = ACHIEVEMENT_GLYPH[a] || ('時代' + a.replace('age', ''));
            ach.appendChild(s);
          });
          panel.appendChild(ach);
        }

        var board = document.createElement('div');
        board.className = 'board-row';
        engine.COLORS.forEach(function (color) {
          var stack = p.board[color];
          var col = document.createElement('div');
          col.className = 'board-column';
          var colHeader = document.createElement('div');
          colHeader.className = 'column-header color-' + color;
          colHeader.textContent = COLOR_JA[color] + (stack.cards.length > 1 ? '（' + DIR_JA[stack.splay] + 'スプレイ）' : '');
          col.appendChild(colHeader);
          stack.cards.slice().reverse().forEach(function (cardId, idx) {
            col.appendChild(cardChip(cardId, { dim: idx !== 0 }));
          });
          board.appendChild(col);
        });
        panel.appendChild(board);

        var zones = document.createElement('div');
        zones.className = 'zone-row';

        var handZone = document.createElement('div');
        handZone.className = 'zone';
        if (p.id === humanPlayerId) {
          handZone.appendChild(zoneLabel('手札（' + p.hand.length + '）'));
          var handCards = document.createElement('div');
          handCards.className = 'zone-cards';
          p.hand.forEach(function (id) { handCards.appendChild(cardChip(id)); });
          handZone.appendChild(handCards);
        } else {
          handZone.appendChild(zoneLabel('手札：' + p.hand.length + '枚'));
        }
        zones.appendChild(handZone);

        var scoreZone = document.createElement('div');
        scoreZone.className = 'zone';
        scoreZone.appendChild(zoneLabel('得点パイル：' + p.score.length + '枚（価値 ' + engine.scoreValue(game, p) + '）'));
        zones.appendChild(scoreZone);

        panel.appendChild(zones);
        el.players.appendChild(panel);
      });

      if (game.solo) renderCultureTrack();
    }

    function renderCultureTrack() {
      var existing = document.getElementById('culture-track');
      if (existing) existing.remove();
      var box = document.createElement('div');
      box.id = 'culture-track';
      box.className = 'culture-track';
      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = '文化トラック（支配政党の目標：' + game.soloGoal + '）';
      box.appendChild(label);
      var row = document.createElement('div');
      row.className = 'culture-track-row';
      engine.ICONS.forEach(function (icon) {
        var pos = game.cultureTrack[icon];
        var cell = document.createElement('span');
        cell.className = 'culture-track-cell';
        cell.textContent = ICON_GLYPH[icon] + ' ' + pos;
        row.appendChild(cell);
      });
      box.appendChild(row);
      el.players.insertBefore(box, el.players.firstChild);
    }

    function zoneLabel(text) {
      var d = document.createElement('div');
      d.className = 'zone-label';
      d.textContent = text;
      return d;
    }

    function showGameOver(g) {
      if (g.winner == null) {
        el.gameOver.textContent = '勝者なしでゲームが終了しました（ターン上限に到達）。';
      } else if (g.winner === 'draw') {
        el.gameOver.textContent = 'ゲームは引き分けで終了しました。';
      } else {
        el.gameOver.textContent = g.players[g.winner].name + ' の勝利！（' + g.endReason + '）';
      }
      el.gameOver.classList.remove('hidden');
      el.actionBar.innerHTML = '';
    }

    function showSoloGameOver(g) {
      var r = g.soloResult;
      if (!r) {
        el.gameOver.textContent = 'ゲームが終了しました（ターン上限に到達、結果は未計算）。';
      } else if (r.victory) {
        el.gameOver.textContent = '勝利！ あなたの得点は ' + r.humanTotal + '、支配政党の目標は ' +
          r.goalTotal + ' でした。文化評価：' + r.cultureRating + '（' + r.cultureName + '）。';
      } else {
        el.gameOver.textContent = '敗北。あなたの得点は ' + r.humanTotal + 'でしたが、支配政党は ' +
          r.goalTotal + ' に到達しました。';
      }
      el.gameOver.classList.remove('hidden');
      el.actionBar.innerHTML = '';
    }

    // ---- modal plumbing -----------------------------------------------------

    function openModal(title) {
      el.modalTitle.textContent = title;
      el.modalBody.innerHTML = '';
      el.modalFooter.innerHTML = '';
      el.modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
      el.modalOverlay.classList.add('hidden');
    }

    function footerButton(label, onClick, opts) {
      opts = opts || {};
      var b = document.createElement('button');
      b.textContent = label;
      b.className = 'btn' + (opts.primary ? ' btn-primary' : '');
      b.disabled = !!opts.disabled;
      b.addEventListener('click', onClick);
      el.modalFooter.appendChild(b);
      return b;
    }

    // ---- controller-facing ask* methods --------------------------------------

    function askAction(player, ctx) {
      return new Promise(function (resolve) {
        el.actionBar.innerHTML = '';
        var label = document.createElement('div');
        label.className = 'action-bar-label';
        label.textContent = 'あなたの番です — 行動を選んでください：';
        el.actionBar.appendChild(label);
        ctx.legal.forEach(function (action) {
          var b = document.createElement('button');
          b.className = 'btn';
          b.textContent = describeAction(ctx.game, player, action);
          b.addEventListener('click', function () {
            el.actionBar.innerHTML = '';
            resolve(action);
          });
          el.actionBar.appendChild(b);
        });
      });
    }

    function describeAction(g, player, action) {
      if (action.type === 'draw') return 'カードを引く';
      if (action.type === 'meld') return byId[action.cardId].name + ' をメルドする';
      if (action.type === 'dogma') {
        var topId = engine.topCard(player, action.color);
        var topName = topId != null ? byId[topId].name : '';
        return COLOR_JA[action.color] + 'のドグマを発動する（' + topName + '）';
      }
      if (action.type === 'achieve') return '時代' + action.age + 'の達成カードを獲得する';
      return action.type;
    }

    function askCard(player, opts) {
      var ids = opts.ids || [];
      var min = opts.min || 0;
      var max = opts.max == null ? ids.length : opts.max;
      if (!ids.length) return Promise.resolve([]);
      return new Promise(function (resolve) {
        openModal(opts.prompt || 'カードを選択');
        var selected = [];
        var chips = {};
        var confirmBtn;

        function refreshConfirm() {
          confirmBtn.disabled = selected.length < min || selected.length > max;
        }

        ids.forEach(function (id) {
          var chip = cardChip(id, {
            onClick: function () {
              var idx = selected.indexOf(id);
              if (idx !== -1) {
                selected.splice(idx, 1);
              } else {
                if (selected.length >= max) return;
                selected.push(id);
              }
              chip.classList.toggle('selected', selected.indexOf(id) !== -1);
              refreshConfirm();
            }
          });
          chips[id] = chip;
          el.modalBody.appendChild(chip);
        });

        var hint = document.createElement('div');
        hint.className = 'modal-hint';
        hint.textContent = min === max ? ('ちょうど' + min + '枚選んでください。') : (min + '〜' + max + '枚選んでください。');
        el.modalBody.appendChild(hint);

        confirmBtn = footerButton('確定', function () {
          closeModal();
          resolve(selected);
        }, { primary: true, disabled: min > 0 });
        refreshConfirm();
      });
    }

    function askColor(player, opts) {
      var colors = opts.colors || [];
      if (!colors.length) return Promise.resolve(null);
      return new Promise(function (resolve) {
        openModal(opts.prompt || '色を選択');
        colors.forEach(function (c) {
          var b = document.createElement('button');
          b.className = 'btn color-' + c;
          b.textContent = COLOR_JA[c] || c;
          b.addEventListener('click', function () { closeModal(); resolve(c); });
          el.modalBody.appendChild(b);
        });
        if (opts.optional) {
          footerButton('スキップ', function () { closeModal(); resolve(null); });
        }
      });
    }

    function askSplay(player, opts) {
      var options = opts.options || [];
      if (!options.length) return Promise.resolve(null);
      return new Promise(function (resolve) {
        openModal(opts.prompt || 'スプレイを選択');
        options.forEach(function (o) {
          var b = document.createElement('button');
          b.className = 'btn color-' + o.color;
          b.textContent = COLOR_JA[o.color] + ' → ' + DIR_JA[o.direction] + 'にスプレイ';
          b.addEventListener('click', function () { closeModal(); resolve(o); });
          el.modalBody.appendChild(b);
        });
        if (opts.optional) {
          footerButton('スキップ', function () { closeModal(); resolve(null); });
        }
      });
    }

    function askPlayer(player, opts) {
      var ids = opts.ids || [];
      if (!ids.length) return Promise.resolve(null);
      return new Promise(function (resolve) {
        openModal(opts.prompt || 'プレイヤーを選択');
        ids.forEach(function (id) {
          var b = document.createElement('button');
          b.className = 'btn';
          b.textContent = game.players[id].name;
          b.addEventListener('click', function () { closeModal(); resolve(id); });
          el.modalBody.appendChild(b);
        });
      });
    }

    function askConfirm(player, prompt) {
      return new Promise(function (resolve) {
        openModal(prompt || '確認しますか？');
        footerButton('はい', function () { closeModal(); resolve(true); }, { primary: true });
        footerButton('いいえ', function () { closeModal(); resolve(false); });
      });
    }

    return {
      setHumanPlayer: setHumanPlayer,
      render: render,
      showGameOver: showGameOver,
      showSoloGameOver: showSoloGameOver,
      askAction: askAction,
      askCard: askCard,
      askColor: askColor,
      askSplay: askSplay,
      askPlayer: askPlayer,
      askConfirm: askConfirm
    };
  }

  return { makeUI: makeUI };
});
