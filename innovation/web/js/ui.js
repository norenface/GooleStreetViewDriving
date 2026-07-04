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
      gameOver: document.getElementById('game-over-banner'),
      cardDetailOverlay: document.getElementById('card-detail-overlay'),
      cardDetailTitle: document.getElementById('card-detail-title'),
      cardDetailBody: document.getElementById('card-detail-body'),
      cardDetailClose: document.getElementById('card-detail-close')
    };

    if (el.cardDetailClose) {
      el.cardDetailClose.addEventListener('click', closeCardDetail);
    }
    if (el.cardDetailOverlay) {
      el.cardDetailOverlay.addEventListener('click', function (e) {
        if (e.target === el.cardDetailOverlay) closeCardDetail();
      });
    }

    function setHumanPlayer(id) { humanPlayerId = id; }

    // Card icon positions (match physical card / BGA spot numbering):
    //   icons[0] = bottom-left   spot_2 (revealed by right splay + up splay)
    //   icons[1] = bottom-center spot_3 (revealed by up splay only)
    //   icons[2] = bottom-right  spot_4 (revealed by left splay + up splay)
    //   icons[3] = top-left      spot_1 (revealed by right splay only; shown in chip header)
    function iconSlot(icon) {
      var s = document.createElement('span');
      s.className = 'icon-slot' + (icon ? '' : ' empty');
      s.textContent = icon ? ICON_GLYPH[icon] : '';
      return s;
    }

    function iconSlotLg(icon) {
      var s = document.createElement('span');
      s.className = 'icon-slot-lg' + (icon ? '' : ' empty');
      s.textContent = icon ? ICON_GLYPH[icon] : '·';
      return s;
    }

    function cardChip(cardId, opts) {
      opts = opts || {};
      var c = byId[cardId];
      var div = document.createElement('div');
      div.className = 'card-chip color-' + c.color + (opts.dim ? ' dim' : '') + (opts.selected ? ' selected' : '');

      // Header row: card name (left) + top-right icon ic[3] (right)
      var header = document.createElement('div');
      header.className = 'chip-header';
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = c.name + ' (' + c.age + ')';
      header.appendChild(name);
      header.appendChild(iconSlot(c.icons[3]));
      div.appendChild(header);

      // Bottom icon row: ic[0]=left, ic[1]=center, ic[2]=right
      var bottom = document.createElement('div');
      bottom.className = 'icon-row';
      bottom.appendChild(iconSlot(c.icons[0]));
      bottom.appendChild(iconSlot(c.icons[1]));
      bottom.appendChild(iconSlot(c.icons[2]));
      div.appendChild(bottom);

      if (opts.onClick) {
        div.addEventListener('click', opts.onClick);
      } else {
        div.className += ' clickable';
        div.addEventListener('click', function (e) {
          e.stopPropagation();
          showCardDetail(cardId);
        });
      }
      return div;
    }

    // Narrow strip shown for a tucked card under a splayed stack.
    // Only the icons that the splay direction exposes are rendered.
    //   left  splay → shows ic[2] (spot_4, bottom-right)
    //   right splay → shows ic[3] (spot_1, top-left) + ic[0] (spot_2, bottom-left)
    //   up    splay → shows ic[0..2] (bottom row: spot_2+3+4)
    function cardPeek(cardId, splayDir) {
      var c = byId[cardId];
      var strip = document.createElement('div');
      strip.className = 'card-peek color-' + c.color + ' peek-' + splayDir;
      strip.addEventListener('click', function (e) {
        e.stopPropagation();
        showCardDetail(cardId);
      });
      if (splayDir === 'left') {
        strip.appendChild(iconSlot(c.icons[2]));
      } else if (splayDir === 'right') {
        strip.appendChild(iconSlot(c.icons[3]));
        strip.appendChild(iconSlot(c.icons[0]));
      } else { // up
        strip.appendChild(iconSlot(c.icons[0]));
        strip.appendChild(iconSlot(c.icons[1]));
        strip.appendChild(iconSlot(c.icons[2]));
      }
      return strip;
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

          // Column header: color name + splay/count info
          var colHeader = document.createElement('div');
          colHeader.className = 'column-header color-' + color;
          var headerInfo = '';
          if (stack.cards.length > 1) {
            headerInfo = stack.splay !== 'none'
              ? '（' + DIR_JA[stack.splay] + 'スプレイ×' + stack.cards.length + '）'
              : '（' + stack.cards.length + '枚）';
          }
          colHeader.textContent = COLOR_JA[color] + headerInfo;
          col.appendChild(colHeader);

          if (stack.cards.length > 0) {
            // cards[last] = top, cards[0] = bottom; reverse to get [top, …, bottom]
            var ordered = stack.cards.slice().reverse();
            var tucked = ordered.slice(1);

            if (stack.splay === 'left' || stack.splay === 'right') {
              // Horizontal layout: peek strips + top card side by side
              var splCont = document.createElement('div');
              splCont.className = 'splay-h splay-h-' + stack.splay;

              if (stack.splay === 'left') {
                // Left splay: deepest card at far-left, top card at right
                // tucked = [2nd-from-top, …, bottom]; reverse → [bottom, …, 2nd-from-top]
                tucked.slice().reverse().forEach(function (cardId) {
                  splCont.appendChild(cardPeek(cardId, 'left'));
                });
                splCont.appendChild(cardChip(ordered[0]));
              } else {
                // Right splay: top card at left, then peeks extending right
                splCont.appendChild(cardChip(ordered[0]));
                tucked.forEach(function (cardId) {
                  splCont.appendChild(cardPeek(cardId, 'right'));
                });
              }
              col.appendChild(splCont);

            } else {
              // Vertical layout: top card, then peek strips or badge below
              col.appendChild(cardChip(ordered[0]));
              if (tucked.length > 0) {
                if (stack.splay === 'none') {
                  // Not splayed — show count only
                  var badge = document.createElement('div');
                  badge.className = 'stack-count';
                  badge.textContent = '＋' + tucked.length + '枚';
                  col.appendChild(badge);
                } else {
                  // Up splay — horizontal strip below each tucked card
                  tucked.forEach(function (cardId) {
                    col.appendChild(cardPeek(cardId, 'up'));
                  });
                }
              }
            }
          }

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

    // ---- card detail popup ---------------------------------------------------
    // Independent of the ask*/modal-overlay plumbing above: it has no Promise
    // to resolve, so it can be opened at any time (even while an ask* prompt
    // is pending) without disturbing the in-flight prompt.

    function showCardDetail(cardId) {
      var c = byId[cardId];
      if (!c || !el.cardDetailOverlay) return;
      el.cardDetailTitle.textContent = c.name + '（時代' + c.age + '・' + (COLOR_JA[c.color] || c.color) + '）';
      el.cardDetailBody.innerHTML = '';

      // Icon layout diagram:
      //              [ic[3]=右上]
      // [ic[0]=左下] [ic[1]=中下] [ic[2]=右下]
      var iconGrid = document.createElement('div');
      iconGrid.className = 'detail-icon-grid';

      var topRow = document.createElement('div');
      topRow.className = 'detail-icon-top';
      topRow.appendChild(iconSlotLg(c.icons[3]));
      iconGrid.appendChild(topRow);

      var botRow = document.createElement('div');
      botRow.className = 'detail-icon-bottom';
      botRow.appendChild(iconSlotLg(c.icons[0]));
      botRow.appendChild(iconSlotLg(c.icons[1]));
      botRow.appendChild(iconSlotLg(c.icons[2]));
      iconGrid.appendChild(botRow);

      el.cardDetailBody.appendChild(iconGrid);

      c.dogma.forEach(function (d) {
        var block = document.createElement('div');
        block.className = 'card-detail-dogma';
        var label = document.createElement('div');
        label.className = 'card-detail-dogma-label';
        label.textContent = ICON_GLYPH[d.icon] + ' ' + (d.demand ? '【強制】ドグマ' : 'ドグマ');
        block.appendChild(label);
        var body = document.createElement('div');
        body.className = 'card-detail-dogma-text';
        body.textContent = d.textJa || d.text || '';
        block.appendChild(body);
        el.cardDetailBody.appendChild(block);
      });
      el.cardDetailOverlay.classList.remove('hidden');
    }

    function closeCardDetail() {
      el.cardDetailOverlay.classList.add('hidden');
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
