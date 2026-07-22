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

  function makeUI(engine, cardsDb, effectDefs) {
    var byId = {};
    cardsDb.forEach(function (c) { byId[c.id] = c; });

    var game = null;
    var humanPlayerId = 0;

    var el = {
      log: document.getElementById('log-panel'),
      players: document.getElementById('players-area'),
      actionBar: document.getElementById('action-bar'),
      modalOverlay: document.getElementById('modal-overlay'),
      modalDogmaSource: document.getElementById('modal-dogma-source'),
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

    // Long-press detection: fires callback after 600ms hold.
    // Suppresses the subsequent mobile click event via capture-phase guard.
    // Also handles desktop right-click (contextmenu).
    function addLongPress(element, callback) {
      var timer = null;
      var guard = false;
      element.addEventListener('touchstart', function () {
        timer = setTimeout(function () {
          timer = null;
          guard = true;
          callback();
        }, 600);
      }, { passive: true });
      function cancelTimer() {
        if (timer) { clearTimeout(timer); timer = null; }
      }
      element.addEventListener('touchend', cancelTimer);
      element.addEventListener('touchcancel', cancelTimer);
      element.addEventListener('touchmove', cancelTimer);
      element.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        callback();
      });
      element.addEventListener('click', function (e) {
        if (guard) { guard = false; e.stopImmediatePropagation(); }
      }, true);
    }

    function cardChip(cardId, opts) {
      opts = opts || {};
      var c = byId[cardId];
      var illust = (window.CARD_ILLUST && window.CARD_ILLUST[c.id]) || '';
      var illustUsed = false;
      function slotWithIllust(icon) {
        if (icon) return iconSlot(icon);
        var s = document.createElement('span');
        if (illust && !illustUsed) {
          illustUsed = true;
          s.className = 'icon-slot illust'; s.textContent = illust;
        } else { s.className = 'icon-slot empty'; s.textContent = ''; }
        return s;
      }
      var div = document.createElement('div');
      div.className = 'card-chip color-' + c.color +
        (opts.dim ? ' dim' : '') +
        (opts.selected ? ' selected' : '') +
        ' clickable';

      // Header: ic[3] (left) + card name (flex) + age badge (right)
      var header = document.createElement('div');
      header.className = 'chip-header';
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = c.name;
      var ageBadge = document.createElement('span');
      ageBadge.className = 'age-badge';
      ageBadge.textContent = c.age;
      header.appendChild(slotWithIllust(c.icons[3]));
      header.appendChild(name);
      header.appendChild(ageBadge);
      div.appendChild(header);

      // Bottom icon row: ic[0]=left corner, ic[1]=center, ic[2]=right corner
      var bottom = document.createElement('div');
      bottom.className = 'icon-row';
      bottom.appendChild(slotWithIllust(c.icons[0]));
      bottom.appendChild(slotWithIllust(c.icons[1]));
      bottom.appendChild(slotWithIllust(c.icons[2]));
      div.appendChild(bottom);

      div.addEventListener('click', opts.onClick || function (e) {
        e.stopPropagation();
        showCardDetail(cardId);
      });
      if (opts.onLongPress) addLongPress(div, opts.onLongPress);
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

    // ---- action popup (bottom sheet) ----------------------------------------

    var _actionPopupEl = null;

    function showActionPopup(title, buttons) {
      closeActionPopup();
      var overlay = document.createElement('div');
      overlay.id = 'action-popup-overlay';
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeActionPopup();
      });
      var box = document.createElement('div');
      box.id = 'action-popup-box';
      var titleEl = document.createElement('div');
      titleEl.id = 'action-popup-title';
      titleEl.textContent = title;
      box.appendChild(titleEl);
      var btnWrap = document.createElement('div');
      btnWrap.id = 'action-popup-buttons';
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' btn-primary' : '');
        btn.textContent = b.label;
        btn.addEventListener('click', function () {
          closeActionPopup();
          b.onSelect();
        });
        btnWrap.appendChild(btn);
      });
      box.appendChild(btnWrap);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      _actionPopupEl = overlay;
    }

    function closeActionPopup() {
      if (_actionPopupEl) { _actionPopupEl.remove(); _actionPopupEl = null; }
    }

    // ---- main board render -------------------------------------------------

    function render(g) {
      game = g;
      renderPileStatus();
      renderLog();
      renderPlayers();
    }

    function renderPileStatus() {
      var container = document.getElementById('pile-status');
      if (!container) return;
      container.innerHTML = '';
      var label = document.createElement('span');
      label.className = 'pile-label';
      label.textContent = '山札：';
      container.appendChild(label);
      for (var age = 1; age <= 10; age++) {
        var pile = game.piles ? game.piles[age] : null;
        var count = pile ? pile.length : 0;
        var badge = document.createElement('span');
        badge.className = 'pile-badge' + (count === 0 ? ' empty' : '');
        var ageSpan = document.createElement('span');
        ageSpan.className = 'pile-badge-age';
        ageSpan.textContent = age;
        var countSpan = document.createElement('span');
        countSpan.textContent = '/' + count;
        badge.appendChild(ageSpan);
        badge.appendChild(countSpan);
        container.appendChild(badge);
      }
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

    // interactiveOpts (optional): { meldActions, dogmaActions, onAction }
    // When set and the player is human, board top cards and hand cards get
    // tap→action-popup and long-press→card-detail behaviour.
    function renderPlayers(interactiveOpts) {
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
        var isHumanPlayer = p.id === humanPlayerId;

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
            // cards[last]=top, cards[0]=bottom; reverse → [top, …, bottom]
            var ordered = stack.cards.slice().reverse();
            var tucked = ordered.slice(1);
            var topCardId = ordered[0];

            // Build opts for the top card chip
            var topCardOpts = {
              onLongPress: (function (tcId) {
                return function () { showCardDetail(tcId); };
              })(topCardId)
            };
            if (interactiveOpts && isHumanPlayer) {
              var dogmaAction = null;
              for (var di = 0; di < interactiveOpts.dogmaActions.length; di++) {
                if (interactiveOpts.dogmaActions[di].color === color) {
                  dogmaAction = interactiveOpts.dogmaActions[di];
                  break;
                }
              }
              if (dogmaAction) {
                topCardOpts.onClick = (function (da, tcId, actor) {
                  return function () {
                    var cardName = (byId[tcId] || {}).name || tcId;
                    showActionPopup(cardName + ' のドグマ', [
                      { label: '発動', primary: true, onSelect: function () {
                        var effs = (effectDefs || {})[tcId] || [];
                        var allDemand = effs.length > 0 && effs.every(function (e) { return e.demand; });
                        if (allDemand) {
                          var noEligible = effs.every(function (eff) {
                            var actorCount = engine.iconCount(game, actor, eff.icon);
                            return !game.players.some(function (op) {
                              return op.id !== actor.id && engine.iconCount(game, op, eff.icon) < actorCount;
                            });
                          });
                          if (noEligible) {
                            var iconGlyph = ICON_GLYPH[effs[0].icon] || effs[0].icon;
                            askConfirm(actor, '自身より ' + iconGlyph + ' のアイコンが少ない人がいませんがよろしいでしょうか？').then(function (yes) {
                              if (yes) interactiveOpts.onAction(da);
                            });
                            return;
                          }
                        }
                        interactiveOpts.onAction(da);
                      }},
                      { label: '戻る', onSelect: function () {} }
                    ]);
                  };
                })(dogmaAction, topCardId, p);
              }
            }

            if (stack.splay === 'left' || stack.splay === 'right') {
              // Horizontal layout: peek strips + top card side by side
              var splCont = document.createElement('div');
              splCont.className = 'splay-h splay-h-' + stack.splay;

              if (stack.splay === 'left') {
                // Left splay: cards slide left → top card at LEFT, peeks on RIGHT (ic[2] visible)
                splCont.appendChild(cardChip(topCardId, topCardOpts));
                tucked.forEach(function (cardId) {
                  splCont.appendChild(cardPeek(cardId, 'left'));
                });
              } else {
                // Right splay: cards slide right → peeks on LEFT (ic[3]+ic[0] visible), top card at RIGHT
                tucked.slice().reverse().forEach(function (cardId) {
                  splCont.appendChild(cardPeek(cardId, 'right'));
                });
                splCont.appendChild(cardChip(topCardId, topCardOpts));
              }
              col.appendChild(splCont);

            } else {
              // Vertical layout: top card, then peek strips or badge below
              col.appendChild(cardChip(topCardId, topCardOpts));
              if (tucked.length > 0) {
                if (stack.splay === 'none') {
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
          p.hand.forEach(function (id) {
            if (!id || !byId[id]) return; // hidden card (null) – skip
            var handOpts = {
              onLongPress: (function (cid) {
                return function () { showCardDetail(cid); };
              })(id)
            };
            if (interactiveOpts) {
              var meldAction = null;
              for (var mi = 0; mi < interactiveOpts.meldActions.length; mi++) {
                if (interactiveOpts.meldActions[mi].cardId === id) {
                  meldAction = interactiveOpts.meldActions[mi];
                  break;
                }
              }
              if (meldAction) {
                handOpts.onClick = (function (ma, cardId) {
                  return function () {
                    var cardName = (byId[cardId] || {}).name || cardId;
                    showActionPopup(cardName, [
                      { label: 'メルドする', primary: true, onSelect: function () { interactiveOpts.onAction(ma); } },
                      { label: '戻る', onSelect: function () {} }
                    ]);
                  };
                })(meldAction, id);
              }
            }
            handCards.appendChild(cardChip(id, handOpts));
          });
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
      if (el.modalDogmaSource) {
        var srcCardId = game && game.currentDogmaCardId;
        var src = srcCardId && byId[srcCardId];
        if (src) {
          el.modalDogmaSource.innerHTML = '';
          var dsLabel = document.createElement('span');
          dsLabel.className = 'modal-dogma-label';
          dsLabel.textContent = '発動カード：';
          el.modalDogmaSource.appendChild(dsLabel);
          var dsChip = cardChip(srcCardId, {});
          addLongPress(dsChip, function () { showCardDetail(srcCardId); });
          el.modalDogmaSource.appendChild(dsChip);
          el.modalDogmaSource.classList.remove('hidden');
        } else {
          el.modalDogmaSource.classList.add('hidden');
        }
      }
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

      var illust = (window.CARD_ILLUST && window.CARD_ILLUST[c.id]) || '';
      var illustUsed = false;
      function detailSlot(icon) {
        var s = document.createElement('span');
        if (icon) { s.className = 'icon-slot'; s.textContent = ICON_GLYPH[icon]; }
        else if (illust && !illustUsed) {
          illustUsed = true;
          s.className = 'icon-slot illust'; s.textContent = illust;
        } else { s.className = 'icon-slot empty'; s.textContent = ''; }
        return s;
      }

      // Enlarged chip — same structure as cardChip()
      var chipDiv = document.createElement('div');
      chipDiv.className = 'card-detail-chip color-' + c.color;

      var hdr = document.createElement('div');
      hdr.className = 'chip-header';
      var nm = document.createElement('span');
      nm.className = 'card-name';
      nm.textContent = c.name;
      var ab = document.createElement('span');
      ab.className = 'age-badge';
      ab.textContent = c.age;
      hdr.appendChild(detailSlot(c.icons[3]));
      hdr.appendChild(nm);
      hdr.appendChild(ab);
      chipDiv.appendChild(hdr);

      var row = document.createElement('div');
      row.className = 'icon-row';
      row.appendChild(detailSlot(c.icons[0]));
      row.appendChild(detailSlot(c.icons[1]));
      row.appendChild(detailSlot(c.icons[2]));
      chipDiv.appendChild(row);

      el.cardDetailBody.appendChild(chipDiv);

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

    // ---- special achievement conditions viewer --------------------------------

    var SPECIAL_ACH_INFO = [
      { id: 'monument', glyph: '🗿', name: '記念碑', condition: '1ターン中にタック/スコアを6回行う' },
      { id: 'empire',   glyph: '🎖️', name: '帝国',   condition: '6種類すべてのアイコンをそれぞれ3個以上持つ' },
      { id: 'wonder',   glyph: '✨',  name: '驚異',   condition: '5色すべての山を「上」または「右」にスプレイする' },
      { id: 'world',    glyph: '🌍', name: '世界',   condition: '盤面上の時計アイコンが合計12個以上' },
      { id: 'universe', glyph: '🌌', name: '宇宙',   condition: '5色すべてのトップカードが時代8以上' }
    ];

    // ---- controller-facing ask* methods --------------------------------------

    // Replaces the old button-list action bar.
    // Draw and Achieve actions appear as buttons in the action bar.
    // Meld and Dogma actions are triggered by tapping the card on the board/hand.
    // Long-pressing any card shows its card detail.
    function askAction(player, ctx) {
      return new Promise(function (resolve) {
        var settled = false;
        function settle(action) {
          if (settled) return;
          settled = true;
          closeActionPopup();
          el.actionBar.innerHTML = '';
          renderPlayers(); // clear interactive handlers
          resolve(action);
        }

        el.actionBar.innerHTML = '';
        var label = document.createElement('div');
        label.className = 'action-bar-label';
        label.textContent = 'あなたの番です — 手札・盤面のカードをタップして行動：';
        el.actionBar.appendChild(label);

        ctx.legal.forEach(function (action) {
          if (action.type !== 'draw' && action.type !== 'achieve') return;
          var b = document.createElement('button');
          b.className = 'btn' + (action.type === 'draw' ? ' btn-primary' : '');
          b.textContent = action.type === 'draw' ? 'カードを引く' : '時代' + action.age + 'を達成';
          b.addEventListener('click', function () { settle(action); });
          el.actionBar.appendChild(b);
        });

        var meldActions = ctx.legal.filter(function (a) { return a.type === 'meld'; });
        var dogmaActions = ctx.legal.filter(function (a) { return a.type === 'dogma'; });

        renderPlayers({
          meldActions: meldActions,
          dogmaActions: dogmaActions,
          onAction: settle
        });
      });
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
            },
            onLongPress: function () { showCardDetail(id); }
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
