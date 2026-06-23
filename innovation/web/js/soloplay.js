// Innovation - "SoloPlay" single-player variant (fan variant by BGG user
// GameRulesforOne, base-game rules only - expansion content is out of scope
// since this app only implements the base 105-card set).
//
// Instead of a second human/AI player, the human plays against a "Ruling
// Party" (RP): a non-strategic opponent that only draws-and-melds cards
// (never chooses to draw, dogma or achieve on its own) but forces a shared
// "culture track" (one counter per icon type) upward on every single meld it
// makes. The culture track gives RP a passive icon bonus when defending
// against/sharing in the human's dogmas, and crossing a track's scoring line
// raises a "Ruling Party" scoring goal that the human must beat at game end.
//
// This is a self-contained module with its own turn loop (reusing engine.js
// primitives directly) rather than going through flow.js's generic
// chooseAction-driven turn loop, because RP's turn shape (always a literal
// draw+meld pair, never an independent dogma/achieve "action", a turn that
// can be 1 or 2 draw+meld pairs) and the human's modified achieve cost
// (paid for from the score pile, rather than just a score-value threshold)
// don't fit flow.js's normal per-action-type contract.
//
// Deliberate simplifications vs. the source PDF (kept small/documented
// rather than chasing 100% fidelity - this is a fan variant, not an official
// rule set):
//  - The "5/6 icon arrival bonus" when crossing a culture scoring line is
//    collapsed to a flat +5 (the source uses 6 for the first line, 5 after).
//  - The active player's *optional* culture-track contribution on their own
//    melds is not modeled (skipped every time); only RP's *mandatory*
//    per-meld advance is implemented, which is the rule that actually drives
//    the solo challenge.
//  - RP's choice between "advance a 2nd icon" vs. "meld a 2nd card" on an
//    extended turn (the source has the *active player* make this call) is
//    decided by a fixed heuristic instead of prompting the human.
//  - The optional end-game "spend your score pile to bump up culture
//    markers" action is not offered.
//  - Figures/Cities/Artifacts expansion rules are entirely out of scope.
//  - A handful of official cards' instant-win clauses (A.I., Globalization,
//    Self Service, Empiricism, Collaboration, Fission, Bioengineering) are
//    not modeled here because effects.js does not implement those clauses
//    for *any* player/mode - this module inherits that existing scope limit
//    rather than introducing a new one.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationSoloPlay = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return function (engine, effectDefs) {
    var ICONS = engine.ICONS;
    var LINE_SIZE = 5; // positions per culture-track segment before a "scoring line"
    var LINE_ARRIVAL_BONUS = 5; // flat simplification of the source's 6-then-5 bonus

    function makeSoloGame(cardDb, humanName, opts) {
      opts = opts || {};
      var game = engine.createGame(cardDb, [
        { name: humanName || 'You', kind: 'human' },
        { name: 'Ruling Party', kind: 'soloBot' }
      ], opts);
      game.solo = true;
      game.cultureTrack = {};
      ICONS.forEach(function (i) { game.cultureTrack[i] = 0; });
      game.soloGoal = 0;
      game.soloResult = null;
      return game;
    }

    function primaryIcon(game, cardId) {
      var defs = effectDefs[cardId];
      if (defs && defs.length && defs[0].icon) return defs[0].icon;
      var c = engine.card(game, cardId);
      return c.icons.filter(Boolean)[0] || null;
    }

    function rpIconCount(game, rp, icon, lineCrossBoost) {
      var base = engine.iconCount(game, rp, icon);
      if (lineCrossBoost) return base + LINE_ARRIVAL_BONUS;
      if (base <= 0) return base; // track bonus only applies with a matching top-card icon
      return base + (game.cultureTrack[icon] % LINE_SIZE);
    }

    function countFor(game, player, icon) {
      return player.kind === 'soloBot' ? rpIconCount(game, player, icon, false) : engine.iconCount(game, player, icon);
    }

    // RP never gains special achievements (the source rule); strip any it was
    // mechanically granted by a shared engine primitive and return them to
    // the supply so the human can still claim them.
    function stripRPSpecialAchievements(game, rp) {
      var specials = engine.SPECIAL_ACHIEVEMENTS;
      var kept = [];
      rp.achievements.forEach(function (a) {
        if (specials.indexOf(a) !== -1) {
          game.specialAchievementsAvailable.push(a);
          game.log.push('(SoloPlay) The Ruling Party cannot claim special achievements; ' + a + ' remains available.');
        } else {
          kept.push(a);
        }
      });
      rp.achievements = kept;
    }

    async function setupSoloGame(game) {
      var human = game.players[0], rp = game.players[1];
      var a = engine.drawCard(game, human, 1);
      var b = engine.drawCard(game, human, 1);
      var keep = await human.controller.chooseCard(human, {
        ids: [a, b], prompt: 'Choose a card to meld as your first card.', min: 1, max: 1
      });
      var meldId = (keep && keep[0]) || a;
      engine.meldCard(game, human, meldId, { silent: true });

      var rpId = engine.drawCard(game, rp, 1);
      engine.meldCard(game, rp, rpId, { silent: true });
      game.cultureTrack[primaryIcon(game, rpId)]++;

      var humanCard = engine.card(game, meldId), rpCard = engine.card(game, rpId);
      var firstIsHuman = humanCard.name.localeCompare(rpCard.name) < 0;
      game.currentPlayer = firstIsHuman ? human.id : rp.id;
      game.firstTurnSingleActionFor = {};
      game.firstTurnSingleActionFor[game.currentPlayer] = true;
      game.log.push((firstIsHuman ? human.name : rp.name) + ' goes first.');
    }

    function soloLegalActions(game, human) {
      var allowed = [{ type: 'draw' }];
      human.hand.forEach(function (id) { allowed.push({ type: 'meld', cardId: id }); });
      engine.COLORS.forEach(function (c) {
        if (engine.topCard(human, c) != null) allowed.push({ type: 'dogma', color: c });
      });
      for (var age = 1; age <= 9; age++) {
        if (soloCanAchieve(game, human, age)) allowed.push({ type: 'achieve', age: age });
      }
      return allowed;
    }

    function soloAchieveCost(game, human, age) {
      var already = human.achievements
        .filter(function (a) { return /^age\d+$/.test(a); })
        .map(function (a) { return parseInt(a.slice(3), 10); });
      var base = age * 5;
      if (already.length && age > Math.max.apply(null, already)) return base + 5;
      return base;
    }

    function soloCanAchieve(game, human, age) {
      if (!game.achievementsAvailable[age]) return false;
      var hasTop = engine.COLORS.some(function (c) {
        var t = engine.topCardObj(game, human, c);
        return t && t.age >= age;
      });
      if (!hasTop) return false;
      var cost = soloAchieveCost(game, human, age);
      var totalValue = human.score.reduce(function (s, id) { return s + engine.card(game, id).age; }, 0);
      return totalValue >= cost;
    }

    // Pay for the achievement from the score pile (cheapest cards first, to
    // minimize overpayment) - "no change is given" per the source rule.
    function soloAchieve(game, human, age) {
      if (!soloCanAchieve(game, human, age)) return false;
      var cost = soloAchieveCost(game, human, age);
      var pool = human.score.slice()
        .map(function (id) { return { id: id, age: engine.card(game, id).age }; })
        .sort(function (a, b) { return a.age - b.age; });
      var paid = [], sum = 0;
      for (var i = 0; i < pool.length && sum < cost; i++) { paid.push(pool[i].id); sum += pool[i].age; }
      paid.forEach(function (id) { engine.returnCard(game, id, human.score); });
      delete game.achievementsAvailable[age];
      human.achievements.push('age' + age);
      game.log.push(human.name + ' pays ' + sum + ' (cost ' + cost + ') to claim the age ' + age + ' achievement!');
      if (game.winner == null && human.achievements.length >= engine.achievementsNeededToWin(game)) {
        game.winner = human.id;
        game.endReason = 'achievements';
        game.log.push(human.name + ' wins the game with ' + human.achievements.length + ' achievements!');
      }
      return true;
    }

    // Mirrors engine.executeDogma, but RP's icon counts are boosted by the
    // culture track (see rpIconCount) instead of being read straight off its
    // board like a normal player's.
    async function soloExecuteDogma(game, actor, cardId) {
      var defs = effectDefs[cardId] || [];
      var n = game.players.length;
      var sharedHappened = false;
      for (var ei = 0; ei < defs.length; ei++) {
        var eff = defs[ei];
        if (eff.demand) {
          for (var off = 1; off < n; off++) {
            var target = game.players[(actor.id + off) % n];
            if (countFor(game, target, eff.icon) < countFor(game, actor, eff.icon)) {
              await eff.run({ game: game, actor: actor, target: target, helpers: {} });
            }
          }
        } else {
          var sharedBy = [];
          for (var off2 = 1; off2 < n; off2++) {
            var p = game.players[(actor.id + off2) % n];
            if (countFor(game, p, eff.icon) >= countFor(game, actor, eff.icon)) sharedBy.push(p);
          }
          for (var si = 0; si < sharedBy.length; si++) {
            await eff.run({ game: game, actor: sharedBy[si], target: sharedBy[si], helpers: {} });
            sharedHappened = true;
          }
          await eff.run({ game: game, actor: actor, target: actor, helpers: {} });
        }
      }
      if (sharedHappened) engine.drawCard(game, actor, engine.highestTopValue(game, actor) || 1);
      stripRPSpecialAchievements(game, game.players[1]);
      engine.checkAllSpecialAchievements(game);
      stripRPSpecialAchievements(game, game.players[1]);
    }

    async function performHumanAction(game, human, action) {
      if (action.type === 'draw') {
        engine.drawCard(game, human, engine.highestTopValue(game, human) || 1);
      } else if (action.type === 'meld') {
        if (human.hand.indexOf(action.cardId) === -1) throw new Error('Illegal meld: card not in hand');
        engine.meldCard(game, human, action.cardId);
      } else if (action.type === 'dogma') {
        var cardId = engine.topCard(human, action.color);
        if (cardId == null) throw new Error('Illegal dogma: no top card');
        game.log.push(human.name + ' activates dogma on ' + engine.card(game, cardId).name);
        await soloExecuteDogma(game, human, cardId);
      } else if (action.type === 'achieve') {
        if (!soloAchieve(game, human, action.age)) throw new Error('Illegal achieve: not eligible');
      } else {
        throw new Error('Unknown action type: ' + action.type);
      }
    }

    async function runHumanTurn(game, human, opts) {
      var actionsThisTurn = (game.firstTurnSingleActionFor && game.firstTurnSingleActionFor[human.id]) ? 1 : 2;
      if (game.firstTurnSingleActionFor) delete game.firstTurnSingleActionFor[human.id];
      for (var i = 0; i < actionsThisTurn; i++) {
        if (game.winner != null) return;
        var ctx = { game: game, player: human, legal: soloLegalActions(game, human) };
        var action = await human.controller.chooseAction(human, ctx);
        await performHumanAction(game, human, action);
        if (opts && opts.onAction) opts.onAction(game);
        if (game.winner != null) return;
      }
      engine.nextPlayer(game);
    }

    // Advance the shared culture track for one icon; if it crosses a scoring
    // line, raise the Ruling Party's goal and - if the melded card's dogma
    // for that icon is a demand - resolve it against the human immediately.
    async function advanceCultureTrack(game, rp, icon, meldedCard) {
      game.cultureTrack[icon]++;
      game.log.push('(SoloPlay) The Ruling Party\'s ' + icon + ' culture marker advances to ' + game.cultureTrack[icon] + '.');
      if (game.cultureTrack[icon] % LINE_SIZE !== 0) return;
      game.soloGoal += 3;
      game.log.push('(SoloPlay) A scoring line is crossed! The Ruling Party\'s goal rises to ' + game.soloGoal + '.');
      if (!meldedCard) return;
      var defs = (effectDefs[meldedCard.id] || []).filter(function (e) { return e.icon === icon && e.demand; });
      if (!defs.length) return;
      var human = game.players[0];
      for (var i = 0; i < defs.length; i++) {
        var eff = defs[i];
        var rpCount = rpIconCount(game, rp, icon, true);
        var humanCount = engine.iconCount(game, human, icon);
        if (rpCount > humanCount) {
          game.log.push('(SoloPlay) The Ruling Party demands compliance with ' + meldedCard.name + '!');
          await eff.run({ game: game, actor: rp, target: human, helpers: {} });
        } else {
          game.log.push('(SoloPlay) You successfully defend against the Ruling Party\'s demand.');
        }
      }
      stripRPSpecialAchievements(game, rp);
      engine.checkAllSpecialAchievements(game);
      stripRPSpecialAchievements(game, rp);
    }

    // One "draw and meld" pair for RP: draws straight onto its board (RP has
    // no meaningful hand stage - drawing, scoring and melding are all the
    // same action for it per the source rule).
    async function meldOneRPCard(game, rp) {
      var age = engine.highestTopValue(game, rp) || 1;
      var cardId = engine.drawCard(game, rp, age);
      if (cardId == null || game.winner != null) return null;
      engine.meldCard(game, rp, cardId, { silent: true });
      stripRPSpecialAchievements(game, rp);
      var card = engine.card(game, cardId);
      await advanceCultureTrack(game, rp, primaryIcon(game, cardId), card);
      return card;
    }

    async function runRPTurn(game, rp, opts) {
      var single = !!(game.firstTurnSingleActionFor && game.firstTurnSingleActionFor[rp.id]);
      if (game.firstTurnSingleActionFor) delete game.firstTurnSingleActionFor[rp.id];
      var firstCard = await meldOneRPCard(game, rp);
      if (opts && opts.onAction) opts.onAction(game);
      if (game.winner == null && !single && firstCard) {
        var otherIcons = firstCard.icons.filter(Boolean).filter(function (i) { return i !== primaryIcon(game, firstCard.id); });
        if (otherIcons.length) {
          // Heuristic stand-in for the source rule's human-made choice: a
          // single extra track tick is the lesser evil vs. a whole 2nd meld.
          await advanceCultureTrack(game, rp, otherIcons[0], firstCard);
        } else {
          await meldOneRPCard(game, rp);
        }
        if (opts && opts.onAction) opts.onAction(game);
      }
      if (game.winner != null) return;
      engine.nextPlayer(game);
    }

    function cultureLineBonus(game, icon) {
      return Math.floor(game.cultureTrack[icon] / LINE_SIZE);
    }

    function societyScore(lowestSegment) {
      if (lowestSegment >= 4) return 5;
      return lowestSegment;
    }

    var CULTURE_RATINGS = [
      null, 'Prehistory', 'Classical', 'Medieval', 'Renaissance', 'Exploration',
      'Enlightenment', 'Romance', 'Modern', 'Postmodern', 'Information'
    ];

    function marginScore(margin) {
      if (margin >= 10) return 5;
      if (margin >= 8) return 4;
      if (margin >= 6) return 3;
      if (margin >= 4) return 2;
      if (margin >= 1) return 1;
      return 0;
    }

    // Greedily let RP "buy" the highest-value numeric achievements still
    // available with its score pile at game end (source rule: no overpay
    // restriction at this point, unlike the human's mid-game achieve cost).
    function rpClaimEndGameAchievements(game, rp, human) {
      var pool = rp.score.reduce(function (s, id) { return s + engine.card(game, id).age; }, 0);
      var taken = [];
      for (var age = 9; age >= 1; age--) {
        if (!game.achievementsAvailable[age]) continue;
        if (pool >= age * 5) { pool -= age * 5; taken.push(age); }
      }
      return taken;
    }

    function computeSoloEndGameResult(game) {
      var human = game.players[0], rp = game.players[1];

      var rpNumeric = rpClaimEndGameAchievements(game, rp, human);
      var goalTotal = game.soloGoal;
      goalTotal += game.specialAchievementsAvailable.length; // unclaimed specials favor RP
      goalTotal += rpNumeric.reduce(function (s, age) { return s + age; }, 0);
      ICONS.forEach(function (icon) { goalTotal += cultureLineBonus(game, icon); });

      var humanNumeric = human.achievements
        .filter(function (a) { return /^age\d+$/.test(a); })
        .map(function (a) { return parseInt(a.slice(3), 10); })
        .reduce(function (s, age) { return s + age; }, 0);
      var humanSpecials = human.achievements.filter(function (a) { return engine.SPECIAL_ACHIEVEMENTS.indexOf(a) !== -1; }).length;
      var lowestSegment = Math.min.apply(null, ICONS.map(function (icon) { return cultureLineBonus(game, icon); }));
      var humanTotal = humanNumeric + humanSpecials * 2 + societyScore(lowestSegment);

      var victory = humanTotal > goalTotal;
      var margin = humanTotal - goalTotal;
      var cultureRating = null, narrative = null;
      if (victory) {
        cultureRating = marginScore(margin) + societyScore(lowestSegment);
        cultureRating = Math.max(1, Math.min(10, cultureRating));
        narrative = CULTURE_RATINGS[cultureRating];
      }

      return {
        victory: victory,
        humanTotal: humanTotal,
        goalTotal: goalTotal,
        margin: margin,
        cultureRating: cultureRating,
        cultureName: narrative,
        rpNumericAchievements: rpNumeric
      };
    }

    async function playSoloGame(game, opts) {
      opts = opts || {};
      var maxTurns = opts.maxTurns || 2000;
      var human = game.players[0], rp = game.players[1];
      await setupSoloGame(game);
      if (opts.onAction) opts.onAction(game);
      var turns = 0;
      while (game.winner == null && turns < maxTurns) {
        if (game.currentPlayer === human.id) await runHumanTurn(game, human, opts);
        else await runRPTurn(game, rp, opts);
        turns++;
      }
      game.soloResult = computeSoloEndGameResult(game);
      return game;
    }

    return {
      makeSoloGame: makeSoloGame,
      setupSoloGame: setupSoloGame,
      soloLegalActions: soloLegalActions,
      soloCanAchieve: soloCanAchieve,
      soloAchieveCost: soloAchieveCost,
      soloAchieve: soloAchieve,
      soloExecuteDogma: soloExecuteDogma,
      performHumanAction: performHumanAction,
      runHumanTurn: runHumanTurn,
      runRPTurn: runRPTurn,
      computeSoloEndGameResult: computeSoloEndGameResult,
      playSoloGame: playSoloGame
    };
  };
});
