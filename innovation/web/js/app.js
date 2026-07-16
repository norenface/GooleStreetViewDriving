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
  var soloplay = window.InnovationSoloPlay(engine, effects);
  var ui = window.InnovationUI.makeUI(engine, cardsDb);

  var HUMAN_SEAT = 0;

  var setupScreen = document.getElementById('setup-screen');
  var gameScreen = document.getElementById('game-screen');
  var playerCountSelect = document.getElementById('player-count');
  var opponentRows = document.getElementById('opponent-rows');
  var soloInfo = document.getElementById('solo-info');
  var startBtn = document.getElementById('start-game-btn');

  function renderOpponentRows() {
    if (playerCountSelect.value === 'solo') {
      opponentRows.innerHTML = '';
      opponentRows.classList.add('hidden');
      soloInfo.classList.remove('hidden');
      return;
    }
    opponentRows.classList.remove('hidden');
    soloInfo.classList.add('hidden');
    var n = parseInt(playerCountSelect.value, 10);
    opponentRows.innerHTML = '';
    for (var i = 1; i < n; i++) {
      var row = document.createElement('div');
      row.className = 'opponent-row';
      var label = document.createElement('span');
      label.textContent = 'プレイヤー ' + (i + 1);
      var select = document.createElement('select');
      select.dataset.seat = i;
      ['ai', 'random'].forEach(function (kind) {
        var opt = document.createElement('option');
        opt.value = kind;
        opt.textContent = kind === 'ai' ? 'CPU（賢い）' : 'CPU（ランダム）';
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
    if (playerCountSelect.value === 'solo') {
      startSoloGame();
      return;
    }
    var n = parseInt(playerCountSelect.value, 10);
    var specs = [{ name: 'あなた', kind: 'human' }];
    var opponentKinds = [];
    opponentRows.querySelectorAll('select').forEach(function (sel) {
      opponentKinds.push(sel.value);
    });
    for (var i = 1; i < n; i++) {
      var kind = opponentKinds[i - 1] || 'ai';
      specs.push({ name: 'CPU' + i + (kind === 'random' ? '（ランダム）' : ''), kind: 'ai' });
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
      banner.textContent = 'エラーが発生しました: ' + err.message;
      banner.classList.remove('hidden');
    });
  });

  // ---- card list overlay -------------------------------------------------------

  var ICON_GLYPH_CL = {
    leaf: '🌿', crown: '👑', lightbulb: '💡',
    factory: '🏭', castle: '🏰', clock: '🕰️'
  };
  var COLOR_JA_CL = { yellow: '黄', red: '赤', green: '緑', blue: '青', purple: '紫' };

  function addLongPressCL(elem, cb) {
    var timer = null;
    var guard = false;
    elem.addEventListener('touchstart', function () {
      timer = setTimeout(function () { timer = null; guard = true; cb(); }, 600);
    }, { passive: true });
    function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
    elem.addEventListener('touchend', cancel);
    elem.addEventListener('touchcancel', cancel);
    elem.addEventListener('touchmove', cancel);
    elem.addEventListener('contextmenu', function (e) { e.preventDefault(); cb(); });
    elem.addEventListener('click', function (e) {
      if (guard) { guard = false; e.stopImmediatePropagation(); }
    }, true);
  }

  function makeIconSlotLgCL(icon) {
    var span = document.createElement('span');
    span.className = 'icon-slot-lg' + (icon ? '' : ' empty');
    span.textContent = icon ? (ICON_GLYPH_CL[icon] || icon) : '·';
    return span;
  }

  function showCardDetailCL(c) {
    var overlay = document.getElementById('card-detail-overlay');
    var titleEl = document.getElementById('card-detail-title');
    var bodyEl = document.getElementById('card-detail-body');
    if (!overlay) return;
    titleEl.textContent = c.name + '（時代' + c.age + '・' + (COLOR_JA_CL[c.color] || c.color) + '）';
    bodyEl.innerHTML = '';

    var illust = (window.CARD_ILLUST && window.CARD_ILLUST[c.id]) || '';
    var illustUsed = false;
    function detailSlotCL(icon) {
      var s = document.createElement('span');
      if (icon) { s.className = 'icon-slot'; s.textContent = ICON_GLYPH_CL[icon] || ''; }
      else if (illust && !illustUsed) {
        illustUsed = true;
        s.className = 'icon-slot illust'; s.textContent = illust;
      } else { s.className = 'icon-slot empty'; s.textContent = ''; }
      return s;
    }

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
    hdr.appendChild(detailSlotCL(c.icons[3]));
    hdr.appendChild(nm);
    hdr.appendChild(ab);
    chipDiv.appendChild(hdr);

    var iconRow = document.createElement('div');
    iconRow.className = 'icon-row';
    iconRow.appendChild(detailSlotCL(c.icons[0]));
    iconRow.appendChild(detailSlotCL(c.icons[1]));
    iconRow.appendChild(detailSlotCL(c.icons[2]));
    chipDiv.appendChild(iconRow);

    bodyEl.appendChild(chipDiv);

    c.dogma.forEach(function (d) {
      var block = document.createElement('div');
      block.className = 'card-detail-dogma';
      var label = document.createElement('div');
      label.className = 'card-detail-dogma-label';
      label.textContent = (ICON_GLYPH_CL[d.icon] || '') + ' ' + (d.demand ? '【強制】ドグマ' : 'ドグマ');
      block.appendChild(label);
      var text = document.createElement('div');
      text.className = 'card-detail-dogma-text';
      text.textContent = d.textJa || d.text || '';
      block.appendChild(text);
      bodyEl.appendChild(block);
    });

    overlay.classList.remove('hidden');
  }

  function renderCardList() {
    var body = document.getElementById('card-list-body');
    body.innerHTML = '';
    var byAge = {};
    cardsDb.forEach(function (c) {
      if (!byAge[c.age]) byAge[c.age] = [];
      byAge[c.age].push(c);
    });
    for (var age = 1; age <= 10; age++) {
      var cards = byAge[age];
      if (!cards || !cards.length) continue;
      var ageHeader = document.createElement('div');
      ageHeader.className = 'card-list-age-header';
      ageHeader.textContent = '時代 ' + age;
      body.appendChild(ageHeader);
      var row = document.createElement('div');
      row.className = 'card-list-row';
      cards.forEach(function (c) {
        var chip = document.createElement('div');
        chip.className = 'card-chip color-' + c.color;
        var illust = (window.CARD_ILLUST && window.CARD_ILLUST[c.id]) || '';
        var illustUsed = false;
        function slotCL(icon) {
          var s = document.createElement('span');
          if (icon) { s.className = 'icon-slot'; s.textContent = ICON_GLYPH_CL[icon] || ''; }
          else if (illust && !illustUsed) {
            illustUsed = true;
            s.className = 'icon-slot illust'; s.textContent = illust;
          } else { s.className = 'icon-slot empty'; s.textContent = '·'; }
          return s;
        }

        var header = document.createElement('div');
        header.className = 'chip-header';
        var name = document.createElement('span');
        name.className = 'card-name';
        name.textContent = c.name;
        var ageBadge = document.createElement('span');
        ageBadge.className = 'age-badge';
        ageBadge.textContent = c.age;
        header.appendChild(slotCL(c.icons[3]));
        header.appendChild(name);
        header.appendChild(ageBadge);
        chip.appendChild(header);

        var iconRow = document.createElement('div');
        iconRow.className = 'icon-row';
        [c.icons[0], c.icons[1], c.icons[2]].forEach(function (ic) {
          iconRow.appendChild(slotCL(ic));
        });
        chip.appendChild(iconRow);

        addLongPressCL(chip, (function (card) {
          return function () { showCardDetailCL(card); };
        }(c)));

        row.appendChild(chip);
      });
      body.appendChild(row);
    }
  }

  document.getElementById('card-list-btn').addEventListener('click', function () {
    renderCardList();
    document.getElementById('card-list-overlay').classList.remove('hidden');
  });
  document.getElementById('card-list-close').addEventListener('click', function () {
    document.getElementById('card-list-overlay').classList.add('hidden');
  });

  // ---- rules overlay ----
  function openRules() {
    document.getElementById('rules-overlay').classList.remove('hidden');
  }
  document.getElementById('rules-btn-setup').addEventListener('click', openRules);
  document.getElementById('rules-btn-game').addEventListener('click', openRules);
  document.getElementById('rules-close').addEventListener('click', function () {
    document.getElementById('rules-overlay').classList.add('hidden');
  });
  document.getElementById('rules-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
  });

  document.getElementById('back-to-top-btn').addEventListener('click', function () {
    if (!confirm('トップ画面に戻りますか？\n現在のゲームの進行状況は失われます。')) return;
    gameScreen.classList.add('hidden');
    document.getElementById('game-over-banner').classList.add('hidden');
    document.getElementById('players-area').innerHTML = '';
    document.getElementById('action-bar').innerHTML = '';
    document.getElementById('log-panel').innerHTML = '';
    setupScreen.classList.remove('hidden');
  });

  // ---- Online (PeerJS) friend play ------------------------------------------

  var peerNet = window.InnovationPeerNetwork;
  var netCtrlFactory = window.InnovationNetworkController;

  var activeNetHandle = null; // { destroy() } – current peer handle
  var activeNetCtrl   = null; // networkController instance (host side)
  var liveGame        = null; // reference to live game (for pre-prompt state sync)
  var guestSendFn     = null; // send function for guest → host responses

  function serializeGame(game) {
    return JSON.parse(JSON.stringify(game, function (k, v) {
      return k === 'controller' ? undefined : v;
    }));
  }

  // Sanitized version for sending to guest:
  //   - Non-guest players' hands are replaced with null-filled arrays (count kept, IDs hidden)
  //   - Draw pile card IDs are replaced with nulls (counts kept)
  function serializeGameForGuest(game, guestIndex) {
    var clone = serializeGame(game);
    clone.players.forEach(function (p, idx) {
      if (idx !== guestIndex) {
        clone.players[idx].hand = Array(p.hand.length).fill(null);
      }
    });
    for (var age = 1; age <= 10; age++) {
      if (clone.piles && clone.piles[age]) {
        clone.piles[age] = Array(clone.piles[age].length).fill(null);
      }
    }
    return clone;
  }

  // ---------- Host: CPU row management ----------

  var onlineCpuRows = []; // [{ kind: 'ai'|'random' }, ...]

  function renderOnlineCpuRows() {
    var container = document.getElementById('online-cpu-rows');
    container.innerHTML = '';
    onlineCpuRows.forEach(function (row, idx) {
      var div = document.createElement('div');
      div.className = 'online-cpu-row';

      var label = document.createElement('span');
      label.className = 'online-hint';
      label.style.margin = '0';
      label.textContent = 'CPU' + (idx + 1);

      var sel = document.createElement('select');
      ['ai', 'random'].forEach(function (k) {
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k === 'ai' ? 'CPU（賢い）' : 'CPU（ランダム）';
        if (row.kind === k) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { onlineCpuRows[idx].kind = sel.value; });

      var removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-remove';
      removeBtn.textContent = '削除';
      removeBtn.addEventListener('click', function () {
        onlineCpuRows.splice(idx, 1);
        renderOnlineCpuRows();
        document.getElementById('add-cpu-btn').disabled = onlineCpuRows.length >= 2;
      });

      div.appendChild(label);
      div.appendChild(sel);
      div.appendChild(removeBtn);
      container.appendChild(div);
    });
  }

  document.getElementById('add-cpu-btn').addEventListener('click', function () {
    if (onlineCpuRows.length >= 2) return;
    onlineCpuRows.push({ kind: 'ai' });
    renderOnlineCpuRows();
    this.disabled = onlineCpuRows.length >= 2;
  });

  // ---------- Host: room creation ----------

  document.getElementById('create-room-btn').addEventListener('click', function () {
    document.getElementById('host-panel').classList.remove('hidden');
    document.getElementById('guest-panel').classList.add('hidden');
  });

  document.getElementById('do-create-room-btn').addEventListener('click', function () {
    var hostName = document.getElementById('host-name-input').value.trim() || 'ホスト';
    document.getElementById('do-create-room-btn').disabled = true;
    document.getElementById('room-code-wrap').classList.remove('hidden');

    if (activeNetHandle) activeNetHandle.destroy();

    var netCtrl = null;
    activeNetHandle = peerNet.createHost({
      onCode: function (code) {
        document.getElementById('room-code-display').textContent = code;
      },
      onConnected: function (sendFn) {
        document.getElementById('host-status').textContent = 'ゲストが接続しました！ゲームを開始してください。';
        document.getElementById('start-online-btn').classList.remove('hidden');

        netCtrl = netCtrlFactory.makeNetworkController(
          sendFn,
          function () { return liveGame; },
          function (g) { return serializeGameForGuest(g, 1); }
        );
        activeNetCtrl = netCtrl;

        document.getElementById('start-online-btn').addEventListener('click', function () {
          var guestName = activeNetHandle._guestName || 'ゲスト';
          var cpuSpecs = onlineCpuRows.map(function (r, i) {
            return { name: 'CPU' + (i + 1), kind: r.kind };
          });
          sendFn({ type: 'init', guestIndex: 1, hostName: hostName, guestName: guestName });
          startOnlineGameAsHost(hostName, guestName, cpuSpecs, sendFn, netCtrl);
        }, { once: true });
      },
      onData: function (msg) {
        if (msg.type === 'hello') {
          activeNetHandle._guestName = msg.name;
          document.getElementById('host-status').textContent =
            msg.name + ' さんが接続しました！ゲームを開始してください。';
          document.getElementById('start-online-btn').classList.remove('hidden');
        }
        if (activeNetCtrl) activeNetCtrl.handleResponse(msg);
      },
      onDisconnected: function () {
        document.getElementById('host-status').textContent = '⚠ 接続が切断されました。';
      },
      onError: function (err) {
        document.getElementById('host-status').textContent = 'エラー: ' + err.message;
        document.getElementById('do-create-room-btn').disabled = false;
      }
    });
  });

  document.getElementById('copy-code-btn').addEventListener('click', function () {
    var code = document.getElementById('room-code-display').textContent;
    navigator.clipboard && navigator.clipboard.writeText(code).then(function () {
      document.getElementById('copy-code-btn').textContent = 'コピー済！';
      setTimeout(function () {
        document.getElementById('copy-code-btn').textContent = 'コピー';
      }, 2000);
    });
  });

  // cpuSpecs: [{ name, kind }] for CPU players beyond host+guest
  function startOnlineGameAsHost(hostName, guestName, cpuSpecs, sendFn, netCtrl) {
    var specs = [{ name: hostName, kind: 'human' }, { name: guestName, kind: 'human' }];
    cpuSpecs.forEach(function (c) { specs.push({ name: c.name, kind: c.kind }); });

    var game = engine.createGame(cardsDb, specs);
    liveGame = game;
    ui.setHumanPlayer(0);
    game.players[0].controller = window.InnovationHumanController.makeHumanController(ui);
    game.players[1].controller = netCtrl;
    // CPU players from index 2 onward
    cpuSpecs.forEach(function (c, i) {
      var idx = 2 + i;
      game.players[idx].controller = c.kind === 'ai'
        ? window.InnovationAIController.makeAIController(engine, cardsDb, effects)
        : window.InnovationRandomController.makeRandomController();
    });

    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    flow.playFullGame(game, {
      maxTurns: 2000,
      onAction: function (g) {
        ui.render(g);
        sendFn({ type: 'state', game: serializeGameForGuest(g, 1) });
      }
    }).then(function (finishedGame) {
      ui.render(finishedGame);
      ui.showGameOver(finishedGame);
      sendFn({ type: 'state', game: serializeGameForGuest(finishedGame, 1) });
      sendFn({ type: 'gameover' });
    }).catch(function (err) {
      console.error(err);
      var banner = document.getElementById('game-over-banner');
      banner.textContent = 'エラー: ' + err.message;
      banner.classList.remove('hidden');
    });
  }

  // ---------- Guest ----------

  document.getElementById('join-room-btn').addEventListener('click', function () {
    document.getElementById('guest-panel').classList.remove('hidden');
    document.getElementById('host-panel').classList.add('hidden');
  });

  document.getElementById('do-join-btn').addEventListener('click', function () {
    var guestName = document.getElementById('guest-name-input').value.trim() || 'ゲスト';
    var code = document.getElementById('room-code-input').value.trim();
    if (!code || code.length !== 6) {
      document.getElementById('guest-status').textContent = '⚠ 6文字のルームコードを入力してください。';
      document.getElementById('guest-status').classList.remove('hidden');
      return;
    }
    document.getElementById('do-join-btn').disabled = true;
    document.getElementById('guest-status').textContent = '接続中…';
    document.getElementById('guest-status').classList.remove('hidden');

    if (activeNetHandle) activeNetHandle.destroy();

    activeNetHandle = peerNet.joinAsGuest(code, {
      onConnected: function (sendFn) {
        guestSendFn = sendFn;
        document.getElementById('guest-status').textContent = '接続できました！ホストのゲーム開始を待っています…';
        sendFn({ type: 'hello', name: guestName });
      },
      onData: function (msg) {
        handleGuestMessage(msg);
      },
      onDisconnected: function () {
        document.getElementById('guest-status').textContent = '⚠ 接続が切断されました。';
        document.getElementById('guest-status').classList.remove('hidden');
      },
      onError: function (err) {
        document.getElementById('guest-status').textContent = '⚠ 接続失敗: ' + (err.message || err.type || err);
        document.getElementById('guest-status').classList.remove('hidden');
        document.getElementById('do-join-btn').disabled = false;
      }
    });
  });

  var guestPendingPrompt = null; // { resolve } waiting for guest UI input

  function handleGuestMessage(msg) {
    if (msg.type === 'state') {
      ui.render(msg.game);
    } else if (msg.type === 'init') {
      ui.setHumanPlayer(msg.guestIndex);
      setupScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
    } else if (msg.type === 'prompt') {
      handleGuestPrompt(msg);
    } else if (msg.type === 'gameover') {
      ui.showGameOver && ui.showGameOver(null);
    }
  }

  async function handleGuestPrompt(msg) {
    var p   = msg.payload;
    var dummy = {};
    var result;

    try {
      if (msg.method === 'chooseAction') {
        result = await ui.askAction(dummy, { legal: p.legal });
      } else if (msg.method === 'chooseCard') {
        result = await ui.askCard(dummy, p);
      } else if (msg.method === 'chooseColor') {
        result = await ui.askColor(dummy, p);
      } else if (msg.method === 'chooseSplay') {
        result = await ui.askSplay(dummy, p);
      } else if (msg.method === 'choosePlayer') {
        result = await ui.askPlayer(dummy, p);
      } else if (msg.method === 'confirm') {
        result = await ui.askConfirm(dummy, p.prompt);
      }
    } catch (e) {
      console.error('handleGuestPrompt error', e);
      result = null;
    }

    if (guestSendFn) guestSendFn({ type: 'response', id: msg.id, value: result });
  }

  // ----------------------------------------------------------------------------

  function startSoloGame() {
    var game = soloplay.makeSoloGame(cardsDb, 'あなた');
    ui.setHumanPlayer(HUMAN_SEAT);
    game.players[HUMAN_SEAT].controller = window.InnovationHumanController.makeHumanController(ui);
    game.players[1].controller = window.InnovationSoloBotController.makeSoloBotController(cardsDb);

    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    soloplay.playSoloGame(game, {
      maxTurns: 1500,
      onAction: function (g) { ui.render(g); }
    }).then(function (finishedGame) {
      ui.render(finishedGame);
      ui.showSoloGameOver(finishedGame);
    }).catch(function (err) {
      console.error(err);
      ui.render(game);
      var banner = document.getElementById('game-over-banner');
      banner.textContent = 'エラーが発生しました: ' + err.message;
      banner.classList.remove('hidden');
    });
  }
})();
