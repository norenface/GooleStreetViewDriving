// Innovation (Carl Chudyk / Asmadi Games) - core rules engine.
// Pure game-logic module: no DOM access, usable from Node (tests) and browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Innovation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COLORS = ['yellow', 'red', 'green', 'blue', 'purple'];
  var ICONS = ['leaf', 'crown', 'lightbulb', 'factory', 'castle', 'clock'];
  var SPECIAL_ACHIEVEMENTS = ['monument', 'empire', 'wonder', 'world', 'universe'];

  var COLOR_JA = { yellow: '黄', red: '赤', green: '緑', blue: '青', purple: '紫' };
  var DIR_JA = { left: '左', right: '右', up: '上' };
  var ZONE_JA = { hand: '手札', score: '得点パイル', board: 'ボード' };
  var ACHIEVEMENT_JA = { monument: '記念碑', empire: '帝国', wonder: '驚異', world: '世界', universe: '宇宙' };

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---- Game state -----------------------------------------------------

  function createPlayer(id, name, kind) {
    return {
      id: id,
      name: name,
      kind: kind || 'human', // 'human' | 'ai' | 'soloBot'
      hand: [],
      score: [],
      board: {
        yellow: { cards: [], splay: 'none' },
        red: { cards: [], splay: 'none' },
        green: { cards: [], splay: 'none' },
        blue: { cards: [], splay: 'none' },
        purple: { cards: [], splay: 'none' }
      },
      achievements: [],
      cultureMarker: 0, // used by SoloPlay "Ruling Party" bot
      tuckOrScoreCountThisTurn: 0, // tracks Monument special achievement eligibility
      controller: null // set externally: HumanController | AIController | SoloBotController
    };
  }

  function createGame(cardDb, playerSpecs, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var piles = {};
    for (var age = 1; age <= 10; age++) piles[age] = [];
    cardDb.forEach(function (c) { piles[c.age].push(c.id); });
    for (var a = 1; a <= 10; a++) shuffle(piles[a], rng);

    var achievements = {};
    for (var ach = 1; ach <= 9; ach++) {
      if (piles[ach] && piles[ach].length) achievements[ach] = true;
    }

    var game = {
      cardDb: cardDb,
      cardsById: {},
      piles: piles,
      achievementsAvailable: achievements,
      specialAchievementsAvailable: SPECIAL_ACHIEVEMENTS.slice(),
      players: playerSpecs.map(function (p, i) { return createPlayer(i, p.name, p.kind); }),
      currentPlayer: 0,
      turn: 1,
      log: [],
      winner: null,
      endReason: null,
      teamOf: opts.teamOf || null, // optional array mapping playerId -> teamId
      rng: rng
    };
    cardDb.forEach(function (c) { game.cardsById[c.id] = c; });
    return game;
  }

  function card(game, id) { return game.cardsById[id]; }
  function topCard(player, color) {
    var cards = player.board[color].cards;
    return cards.length ? cards[cards.length - 1] : null;
  }
  function topCardObj(game, player, color) {
    var id = topCard(player, color);
    return id != null ? card(game, id) : null;
  }

  function log(game, msg) { game.log.push(msg); }

  function highestTopValue(game, player) {
    var best = 0;
    COLORS.forEach(function (c) {
      var t = topCardObj(game, player, c);
      if (t && t.age > best) best = t.age;
    });
    return best;
  }

  function pileTake(game, age) {
    age = Math.max(1, Math.min(10, age));
    while (age <= 10 && (!game.piles[age] || game.piles[age].length === 0)) age++;
    if (age > 10) return null;
    return { age: age, id: game.piles[age].pop() };
  }

  // Draw a card of given age (or next available higher). Returns card id or null.
  function drawCard(game, player, age) {
    var res = pileTake(game, age);
    if (!res) { endGameByTimePassing(game); return null; }
    player.hand.push(res.id);
    log(game, player.name + ' はカードを引いた（時代' + res.age + '）');
    return res.id;
  }

  function endGameByTimePassing(game) {
    if (game.winner != null) return;
    game.endReason = 'time';
    var best = null, bestScore = -1;
    game.players.forEach(function (p) {
      var s = scoreValue(game, p);
      if (s > bestScore) { bestScore = s; best = [p]; }
      else if (s === bestScore) best.push(p);
    });
    if (best.length > 1) {
      var bestAch = -1, finalists = [];
      best.forEach(function (p) {
        var n = p.achievements.length;
        if (n > bestAch) { bestAch = n; finalists = [p]; }
        else if (n === bestAch) finalists.push(p);
      });
      best = finalists;
    }
    game.winner = best.length === 1 ? best[0].id : 'draw';
    log(game, '時代10を超えて時間が経過した。ゲーム終了。' +
      (game.winner === 'draw' ? '引き分けです。' : game.players[game.winner].name + ' が得点で勝利！'));
  }

  function scoreValue(game, player) {
    return player.score.reduce(function (sum, id) { return sum + card(game, id).age; }, 0);
  }

  function meldCard(game, player, cardId, opts) {
    opts = opts || {};
    var c = card(game, cardId);
    var idx = player.hand.indexOf(cardId);
    if (idx === -1) return false;
    player.hand.splice(idx, 1);
    player.board[c.color].cards.push(cardId);
    log(game, player.name + ' は ' + c.name + ' をメルドした');
    if (!opts.silent) onMeld(game, player, c);
    checkAllSpecialAchievements(game);
    return true;
  }

  function onMeld(game, player, c) {
    // hook point for cards reacting to melds (none in base set need it beyond Innovation's own resolution)
  }

  function removeFromCurrentZone(player, cardId) {
    var hi = player.hand.indexOf(cardId);
    if (hi !== -1) { player.hand.splice(hi, 1); return; }
    var si = player.score.indexOf(cardId);
    if (si !== -1) { player.score.splice(si, 1); return; }
    for (var i = 0; i < COLORS.length; i++) {
      var arr = player.board[COLORS[i]].cards;
      var bi = arr.indexOf(cardId);
      if (bi !== -1) { arr.splice(bi, 1); return; }
    }
  }

  // Tuck a card (place at bottom of its color stack). Works for a freshly drawn
  // card (not yet in any zone) or a card already in the player's hand/board/score.
  function tuckCard(game, player, cardId) {
    removeFromCurrentZone(player, cardId);
    var c = card(game, cardId);
    player.board[c.color].cards.unshift(cardId);
    player.tuckOrScoreCountThisTurn = (player.tuckOrScoreCountThisTurn || 0) + 1;
    log(game, player.name + ' は ' + c.name + ' をタックした');
    checkAllSpecialAchievements(game);
  }

  // Score a card. Works for a freshly drawn card or one already in the player's
  // hand/board/score (it is removed from its prior zone first).
  function scoreCard(game, player, cardId) {
    removeFromCurrentZone(player, cardId);
    player.score.push(cardId);
    player.tuckOrScoreCountThisTurn = (player.tuckOrScoreCountThisTurn || 0) + 1;
    log(game, player.name + ' は ' + card(game, cardId).name + ' を得点した');
    checkAllSpecialAchievements(game);
  }

  function returnCard(game, cardId, fromArray) {
    var idx = fromArray.indexOf(cardId);
    if (idx === -1) return false;
    fromArray.splice(idx, 1);
    game.piles[card(game, cardId).age].push(cardId);
    log(game, card(game, cardId).name + ' が補充パイルに戻された');
    return true;
  }

  function removeCard(game, cardId, fromArray) {
    var idx = fromArray.indexOf(cardId);
    if (idx === -1) return false;
    fromArray.splice(idx, 1);
    log(game, card(game, cardId).name + ' がゲームから除外された');
    return true;
  }

  function zoneArray(player, loc) {
    return loc.zone === 'board' ? player.board[loc.color].cards : player[loc.zone];
  }

  // Convenience: return a card to the supply, auto-locating which of the player's
  // zones currently holds it (hand/score/board).
  function returnCardFromPlayer(game, player, cardId) {
    var loc = locateCard(player, cardId);
    if (!loc) return false;
    return returnCard(game, cardId, zoneArray(player, loc));
  }

  // Convenience: remove a card from the game entirely, auto-locating its zone.
  function removeCardFromPlayer(game, player, cardId) {
    var loc = locateCard(player, cardId);
    if (!loc) return false;
    return removeCard(game, cardId, zoneArray(player, loc));
  }

  // Locate a card anywhere in a player's zones. Returns {zone:'hand'|'score'|'board', color?} or null.
  function locateCard(player, cardId) {
    if (player.hand.indexOf(cardId) !== -1) return { zone: 'hand' };
    if (player.score.indexOf(cardId) !== -1) return { zone: 'score' };
    for (var i = 0; i < COLORS.length; i++) {
      if (player.board[COLORS[i]].cards.indexOf(cardId) !== -1) return { zone: 'board', color: COLORS[i] };
    }
    return null;
  }

  function isTopCard(player, cardId) {
    var loc = locateCard(player, cardId);
    return loc && loc.zone === 'board' && topCard(player, loc.color) === cardId;
  }

  // Generic transfer of a single card between zones of (possibly different) players.
  // from/to: { player, zone: 'hand'|'score'|'board', color? }. For board destinations the
  // card is tucked (placed at the bottom of that color's stack), matching the common case
  // of cards joining a board via a dogma transfer rather than a meld action.
  function transferCard(game, cardId, from, to) {
    var fromArr = from.zone === 'board' ? from.player.board[from.color].cards : from.player[from.zone];
    var idx = fromArr.indexOf(cardId);
    if (idx === -1) return false;
    fromArr.splice(idx, 1);
    if (to.zone === 'board') {
      var c = card(game, cardId);
      to.player.board[c.color].cards.unshift(cardId);
    } else {
      to.player[to.zone].push(cardId);
    }
    log(game, card(game, cardId).name + ' が ' + from.player.name + 'の' + (ZONE_JA[from.zone] || from.zone) +
      ' から ' + to.player.name + 'の' + (ZONE_JA[to.zone] || to.zone) + ' に移動した');
    return true;
  }

  function setSplay(game, player, color, direction) {
    var board = player.board[color];
    if (board.cards.length < 2) return false;
    if (board.splay === direction) return false;
    board.splay = direction;
    log(game, player.name + ' は ' + (COLOR_JA[color] || color) + ' を ' + (DIR_JA[direction] || direction) + 'にスプレイした');
    checkAllSpecialAchievements(game);
    return true;
  }

  // Visible icons for a stack given its splay state. Returns array of icon names (with repeats).
  function visibleIconsForStack(game, player, color) {
    var stack = player.board[color];
    var icons = [];
    var cards = stack.cards;
    if (!cards.length) return icons;
    var topId = cards[cards.length - 1];
    icons = icons.concat(card(game, topId).icons.filter(Boolean));
    for (var i = 0; i < cards.length - 1; i++) {
      var c = card(game, cards[i]);
      var ic = c.icons;
      if (stack.splay === 'left') {
        if (ic[2]) icons.push(ic[2]); // spot_4 (bottom-right) revealed
      } else if (stack.splay === 'right') {
        if (ic[3]) icons.push(ic[3]); // spot_1 (top-left) revealed
        if (ic[0]) icons.push(ic[0]); // spot_2 (bottom-left) revealed
      } else if (stack.splay === 'up') {
        if (ic[0]) icons.push(ic[0]); // spot_2 (bottom-left)
        if (ic[1]) icons.push(ic[1]); // spot_3 (bottom-center)
        if (ic[2]) icons.push(ic[2]); // spot_4 (bottom-right)
      }
    }
    return icons;
  }

  function iconCount(game, player, iconName) {
    var total = 0;
    COLORS.forEach(function (c) {
      visibleIconsForStack(game, player, c).forEach(function (i) {
        if (i === iconName) total++;
      });
    });
    return total;
  }

  function totalIcons(game, player) {
    var counts = {};
    ICONS.forEach(function (i) { counts[i] = iconCount(game, player, i); });
    return counts;
  }

  function boardCardCount(player) {
    return COLORS.reduce(function (n, c) { return n + player.board[c].cards.length; }, 0);
  }

  function splayedColorCount(player) {
    return COLORS.reduce(function (n, c) { return n + (player.board[c].splay !== 'none' && player.board[c].cards.length > 1 ? 1 : 0); }, 0);
  }

  // ---- Achievements -----------------------------------------------------

  function canAchieve(game, player, age) {
    if (!game.achievementsAvailable[age]) return false;
    if (scoreValue(game, player) < age * 5) return false;
    var hasTop = COLORS.some(function (c) {
      var t = topCardObj(game, player, c);
      return t && t.age >= age;
    });
    return hasTop;
  }

  function achieve(game, player, age) {
    if (!canAchieve(game, player, age)) return false;
    delete game.achievementsAvailable[age];
    player.achievements.push('age' + age);
    log(game, player.name + ' は時代' + age + 'の達成カードを獲得した！');
    checkWinByAchievements(game, player);
    return true;
  }

  function specialAchievementCheck(game, player, name) {
    if (game.specialAchievementsAvailable.indexOf(name) === -1) return false;
    if (player.achievements.indexOf(name) !== -1) return false;
    if (!specialAchievementMet(game, player, name)) return false;
    game.specialAchievementsAvailable.splice(game.specialAchievementsAvailable.indexOf(name), 1);
    player.achievements.push(name);
    log(game, player.name + ' は特別達成カードを獲得した：' + (ACHIEVEMENT_JA[name] || name) + '！');
    checkWinByAchievements(game, player);
    return true;
  }

  // Direct grant from a card effect — bypasses the standard condition check.
  // Use this when the card itself defines the eligibility condition (e.g., Masonry,
  // Invention). Availability is still checked to prevent double-claiming.
  function claimSpecialAchievement(game, player, name) {
    if (game.specialAchievementsAvailable.indexOf(name) === -1) return false;
    if (player.achievements.indexOf(name) !== -1) return false;
    game.specialAchievementsAvailable.splice(game.specialAchievementsAvailable.indexOf(name), 1);
    player.achievements.push(name);
    log(game, player.name + ' は特別達成カードを獲得した：' + (ACHIEVEMENT_JA[name] || name) + '！');
    checkWinByAchievements(game, player);
    return true;
  }

  // Thresholds per the official rulebook ("Special Achievements" page):
  //   Monument: tuck or score six cards during a single turn (transferred-in cards from
  //             other players, and hand<->score exchanges, do not count).
  //   Empire:   three or more icons of all six icon types.
  //   World:    twelve or more clock icons on your board.
  //   Wonder:   five colors on your board, each splayed either up or right.
  //   Universe: five top cards, each of value 8 or higher.
  function specialAchievementMet(game, player, name) {
    switch (name) {
      case 'wonder':
        return COLORS.every(function (c) { return player.board[c].splay === 'up' || player.board[c].splay === 'right'; });
      case 'empire':
        return ICONS.every(function (i) { return iconCount(game, player, i) >= 3; });
      case 'monument':
        return (player.tuckOrScoreCountThisTurn || 0) >= 6;
      case 'world':
        return iconCount(game, player, 'clock') >= 12;
      case 'universe':
        return COLORS.every(function (c) { var t = topCardObj(game, player, c); return t && t.age >= 8; });
      default:
        return false;
    }
  }

  function checkAllSpecialAchievements(game) {
    // Clockwise from current player as tie-break (current player wins simultaneous ties).
    var n = game.players.length;
    for (var off = 0; off < n; off++) {
      var p = game.players[(game.currentPlayer + off) % n];
      SPECIAL_ACHIEVEMENTS.slice().forEach(function (name) {
        specialAchievementCheck(game, p, name);
      });
    }
  }

  function achievementsNeededToWin(game) {
    var n = game.players.length;
    if (n === 2) return 6;
    if (n === 3) return 5;
    return 4;
  }

  function checkWinByAchievements(game, player) {
    if (game.winner != null) return;
    var teamTotal = player.achievements.length;
    if (game.teamOf) {
      teamTotal = game.players.filter(function (p) { return game.teamOf[p.id] === game.teamOf[player.id]; })
        .reduce(function (s, p) { return s + p.achievements.length; }, 0);
    }
    if (teamTotal >= achievementsNeededToWin(game)) {
      game.winner = player.id;
      game.endReason = 'achievements';
      log(game, player.name + ' は達成カード' + teamTotal + '個でゲームに勝利した！');
    }
  }

  // ---- Dogma resolution --------------------------------------------------

  // effectDefs: card.id -> array of { demand: bool, icon: iconName, run: function(ctx) }
  // ctx = { game, actor, target, effects (shared effects helpers) }

  async function executeDogma(game, actor, cardId, effectDefs, helpers) {
    var sharedHappened = false;
    var n = game.players.length;
    var effects = effectDefs[cardId] || [];

    for (var ei = 0; ei < effects.length; ei++) {
      var eff = effects[ei];
      if (eff.demand) {
        for (var off = 1; off < n; off++) {
          var target = game.players[(actor.id + off) % n];
          if (game.teamOf && game.teamOf[target.id] === game.teamOf[actor.id]) continue;
          var targetIcons = iconCount(game, target, eff.icon);
          var actorCount = iconCount(game, actor, eff.icon);
          if (targetIcons < actorCount) {
            await eff.run({ game: game, actor: actor, target: target, helpers: helpers });
          }
        }
      } else {
        var sharedBy = [];
        for (var off2 = 1; off2 < n; off2++) {
          var p = game.players[(actor.id + off2) % n];
          if (iconCount(game, p, eff.icon) >= iconCount(game, actor, eff.icon)) {
            sharedBy.push(p);
          }
        }
        for (var si = 0; si < sharedBy.length; si++) {
          var p2 = sharedBy[si];
          if (game.teamOf && game.teamOf[p2.id] === game.teamOf[actor.id]) continue;
          await eff.run({ game: game, actor: p2, target: p2, helpers: helpers });
          sharedHappened = true;
        }
        await eff.run({ game: game, actor: actor, target: actor, helpers: helpers });
      }
    }

    if (sharedHappened) {
      drawCard(game, actor, highestTopValue(game, actor) || 1);
    }
    checkAllSpecialAchievements(game);
  }

  async function dogmaAction(game, player, colorOrCardId, effectDefs, helpers) {
    var cardId = typeof colorOrCardId === 'string' && COLORS.indexOf(colorOrCardId) !== -1
      ? topCard(player, colorOrCardId)
      : colorOrCardId;
    if (cardId == null) return false;
    var owner = null;
    COLORS.forEach(function (c) { if (topCard(player, c) === cardId) owner = c; });
    if (!owner) return false;
    log(game, player.name + ' は ' + card(game, cardId).name + ' のドグマを発動した');
    await executeDogma(game, player, cardId, effectDefs, helpers);
    return true;
  }

  function nextPlayer(game) {
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    game.players[game.currentPlayer].tuckOrScoreCountThisTurn = 0;
    game.turn++;
  }

  return {
    COLORS: COLORS,
    ICONS: ICONS,
    SPECIAL_ACHIEVEMENTS: SPECIAL_ACHIEVEMENTS,
    shuffle: shuffle,
    createGame: createGame,
    createPlayer: createPlayer,
    card: card,
    topCard: topCard,
    topCardObj: topCardObj,
    highestTopValue: highestTopValue,
    drawCard: drawCard,
    meldCard: meldCard,
    tuckCard: tuckCard,
    scoreCard: scoreCard,
    returnCard: returnCard,
    removeCard: removeCard,
    returnCardFromPlayer: returnCardFromPlayer,
    removeCardFromPlayer: removeCardFromPlayer,
    locateCard: locateCard,
    isTopCard: isTopCard,
    transferCard: transferCard,
    setSplay: setSplay,
    visibleIconsForStack: visibleIconsForStack,
    iconCount: iconCount,
    totalIcons: totalIcons,
    boardCardCount: boardCardCount,
    splayedColorCount: splayedColorCount,
    canAchieve: canAchieve,
    achieve: achieve,
    specialAchievementCheck: specialAchievementCheck,
    claimSpecialAchievement: claimSpecialAchievement,
    checkAllSpecialAchievements: checkAllSpecialAchievements,
    achievementsNeededToWin: achievementsNeededToWin,
    scoreValue: scoreValue,
    executeDogma: executeDogma,
    dogmaAction: dogmaAction,
    nextPlayer: nextPlayer,
    endGameByTimePassing: endGameByTimePassing,
    log: log
  };
});
