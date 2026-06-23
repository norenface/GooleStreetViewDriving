// Innovation - dogma effect implementations for all 105 base-game cards.
// Pure logic module: depends only on engine.js, no DOM access.
//
// Player choices ("you may...", "a card from your hand", etc.) are resolved through
// player.controller, an object with the following async methods (all return Promises):
//
//   controller.chooseCard(player, { ids, prompt, min, max, optional })
//       -> array of chosen card ids (possibly empty if optional/none available)
//   controller.chooseColor(player, { colors, prompt, optional }) -> color string or null
//   controller.choosePlayer(player, { ids, prompt }) -> player id
//   controller.chooseSplay(player, { options: [{color,direction}], prompt, optional })
//       -> { color, direction } or null
//   controller.confirm(player, prompt) -> boolean
//
// Three controller implementations are expected: HumanController (UI-driven),
// AIController (heuristic "vs PC" opponent), SoloBotController (SoloPlay "Ruling Party").
//
// NOTE on accuracy: dogma text is taken from cards.js (see that file's header for
// provenance/confidence notes). Implementations here follow that text as closely as
// possible; where multiple cards are tied for "highest/lowest" and the rules would let
// the controlling player pick, this module asks that player's controller to break the tie.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationEffects = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return function (engine) {
    var COLORS = engine.COLORS;

    // ---- generic helpers --------------------------------------------------

    function ageOf(game, id) { return engine.card(game, id).age; }
    function colorOf(game, id) { return engine.card(game, id).color; }
    function hasIcon(game, id, icon) { return engine.card(game, id).icons.indexOf(icon) !== -1; }

    function topCardsOf(game, player) {
      return COLORS.map(function (c) { return engine.topCard(player, c); }).filter(function (x) { return x != null; });
    }
    function topCardsWithIcon(game, player, icon) {
      return topCardsOf(game, player).filter(function (id) { return hasIcon(game, id, icon); });
    }
    function extremeByAge(game, ids, dir) {
      if (!ids.length) return [];
      var best = dir === 'max' ? -Infinity : Infinity;
      ids.forEach(function (id) {
        var a = ageOf(game, id);
        if (dir === 'max' ? a > best : a < best) best = a;
      });
      return ids.filter(function (id) { return ageOf(game, id) === best; });
    }

    // Ask the player to pick one card out of a candidate list (auto-resolves if 0 or 1
    // candidates and not "optional"). Returns a card id or null.
    async function pickOne(player, ids, prompt, optional) {
      if (!ids.length) return null;
      if (ids.length === 1 && !optional) return ids[0];
      var res = await player.controller.chooseCard(player, {
        ids: ids, prompt: prompt, min: optional ? 0 : 1, max: 1
      });
      return res && res.length ? res[0] : null;
    }
    async function pickSome(player, ids, prompt, min, max) {
      if (!ids.length) return [];
      var res = await player.controller.chooseCard(player, {
        ids: ids, prompt: prompt, min: min == null ? 0 : min, max: max == null ? ids.length : max
      });
      return res || [];
    }
    async function pickColor(player, colors, prompt, optional) {
      if (!colors.length) return null;
      if (colors.length === 1 && !optional) return colors[0];
      return player.controller.chooseColor(player, { colors: colors, prompt: prompt, optional: !!optional });
    }
    async function pickSplay(player, options, prompt, optional) {
      if (!options.length) return null;
      return player.controller.chooseSplay(player, { options: options, prompt: prompt, optional: !!optional });
    }
    async function yesNo(player, prompt) {
      return player.controller.confirm(player, prompt);
    }

    function splayableColors(player, directions) {
      var out = [];
      COLORS.forEach(function (c) {
        if (player.board[c].cards.length < 2) return;
        directions.forEach(function (d) {
          if (player.board[c].splay !== d) out.push({ color: c, direction: d });
        });
      });
      return out;
    }

    async function maybeReturnFromHand(game, player, prompt, filterFn) {
      var ids = player.hand.filter(filterFn || function () { return true; });
      var id = await pickOne(player, ids, prompt, true);
      if (id) engine.returnCardFromPlayer(game, player, id);
      return id;
    }

    async function drawAndMeld(game, player, age) {
      var id = engine.drawCard(game, player, age);
      if (id) engine.meldCard(game, player, id);
      return id;
    }
    async function drawAndScore(game, player, age) {
      var id = engine.drawCard(game, player, age);
      if (id) engine.scoreCard(game, player, id);
      return id;
    }
    async function drawAndTuck(game, player, age) {
      var id = engine.drawCard(game, player, age);
      if (id) engine.tuckCard(game, player, id);
      return id;
    }

    var effectDefs = {};

    // ======================================================================
    // AGE 1
    // ======================================================================

    effectDefs.agriculture = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var p = ctx.actor, g = ctx.game;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) await drawAndScore(g, p, ageOf(g, id));
      }
    }];

    effectDefs.archery = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, target = ctx.target, actor = ctx.actor;
        if (!target.hand.length) return;
        var highest = extremeByAge(g, target.hand, 'max');
        var id = await pickOne(target, highest, 'Give your highest value card to ' + actor.name + '.');
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'score' });
          await drawAndTuck(g, actor, 1);
        }
      }
    }];

    effectDefs.city_states = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, target = ctx.target, actor = ctx.actor;
        var ids = topCardsWithIcon(g, target, 'castle');
        var id = await pickOne(target, ids, 'Transfer a top castle card to ' + actor.name + '.', true);
        if (id) {
          var a = ageOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          await drawAndTuck(g, target, a);
        } else {
          await drawAndTuck(g, actor, 1);
        }
      }
    }];

    effectDefs.clothing = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ones = p.hand.filter(function (id) { return ageOf(g, id) === 1; });
        var id = await pickOne(p, ones, 'Score a 1 from your hand?', true);
        if (id) {
          engine.scoreCard(g, p, id);
          var leafTops = topCardsWithIcon(g, p, 'leaf').length;
          for (var i = 0; i < leafTops; i++) await drawAndScore(g, p, 1);
        }
      }
    }];

    effectDefs.code_of_laws = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var topColors = {};
        COLORS.forEach(function (c) { if (engine.topCard(p, c) != null) topColors[c] = true; });
        var ids = p.hand.filter(function (id) { return topColors[colorOf(g, id)]; });
        var id = await pickOne(p, ids, 'Tuck a card sharing a color with a top card?', true);
        if (id) {
          var c = colorOf(g, id);
          engine.tuckCard(g, p, id);
          if (await yesNo(p, 'Splay ' + c + ' left?')) engine.setSplay(g, p, c, 'left');
        }
      }
    }];

    effectDefs.domestication = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) await drawAndTuck(g, p, 1);
      }
    }];

    effectDefs.masonry = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = p.hand.filter(function (id) { return hasIcon(g, id, 'castle'); });
        var chosen = await pickSome(p, ids, 'Meld any number of castle cards.', 0, ids.length);
        chosen.forEach(function (id) { engine.meldCard(g, p, id); });
        if (chosen.length >= 3) engine.specialAchievementCheck(g, p, 'monument');
      }
    }];

    effectDefs.metalworking = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        for (;;) {
          var id = engine.drawCard(g, p, 1);
          if (!id) return;
          if (hasIcon(g, id, 'castle')) { engine.scoreCard(g, p, id); }
          else { return; }
        }
      }
    }];

    effectDefs.mysticism = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = engine.drawCard(g, p, 1);
        if (!id) return;
        var c = colorOf(g, id);
        if (engine.topCard(p, c) != null && await yesNo(p, 'Meld the drawn ' + c + ' card?')) {
          engine.meldCard(g, p, id);
        }
      }
    }];

    effectDefs.oars = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.hand.filter(function (id) { return hasIcon(g, id, 'crown'); });
        var id = await pickOne(target, ids, 'Transfer a crown card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'score' });
          await drawAndTuck(g, actor, 1);
          await effectDefs.oars[0].run(ctx);
        } else {
          await drawAndTuck(g, actor, 1);
        }
      }
    }];

    effectDefs.pottery = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), 'Return up to three cards from your hand.', 0, Math.min(3, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length) await drawAndScore(g, p, chosen.length);
      }
    }];

    effectDefs.sailing = [{ demand: false, icon: 'crown', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 1); } }];

    effectDefs.the_wheel = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 1); engine.drawCard(ctx.game, ctx.actor, 1); }
    }];

    effectDefs.tools = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.hand.length >= 3 && await yesNo(p, 'Return three cards from your hand to draw and meld a 3?')) {
          var chosen = await pickSome(p, p.hand.slice(), 'Choose three cards to return.', 3, 3);
          chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          await drawAndMeld(g, p, 3);
        } else {
          var ids = p.hand.filter(function (id) { return hasIcon(g, id, 'factory'); });
          var id = await pickOne(p, ids, 'Return a factory card from your hand?', true);
          if (id) {
            var a = ageOf(g, id);
            engine.returnCardFromPlayer(g, p, id);
            await drawAndMeld(g, p, a + 1);
          }
        }
      }
    }];

    effectDefs.writing = [{ demand: false, icon: 'lightbulb', run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 1); } }];

    // ======================================================================
    // AGE 2
    // ======================================================================

    effectDefs.calendar = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var more = g.players.every(function (o) { return o.id === p.id || p.hand.length > o.hand.length; });
        if (more) {
          var leafCount = engine.iconCount(g, p, 'leaf');
          for (var i = 0; i < leafCount; i++) {
            var id = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
            if (!id) break;
            engine.scoreCard(g, p, id);
          }
          engine.drawCard(g, p, 2);
        }
      }
    }];

    effectDefs.canal_building = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (await yesNo(p, 'Exchange your hand with your score pile?')) {
          var tmp = p.hand; p.hand = p.score; p.score = tmp;
          engine.log(g, p.name + ' exchanges hand and score pile.');
        }
      }
    }];

    effectDefs.construction = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var castles = engine.iconCount(g, p, 'castle');
        var usedAge1 = false;
        for (var i = 0; i < castles; i++) {
          var ids = p.hand.filter(function (id) { return ageOf(g, id) > 1 || !usedAge1; });
          var id = await pickOne(p, ids, 'Meld a card from your hand?', true);
          if (!id) break;
          if (ageOf(g, id) === 1) usedAge1 = true;
          engine.meldCard(g, p, id);
        }
        engine.specialAchievementCheck(g, p, 'empire');
      }
    }];

    effectDefs.currency = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), 'Return any number of cards from your hand.', 0, p.hand.length);
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        var scores = Math.floor(chosen.length / 2);
        for (var i = 0; i < scores; i++) {
          var id = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
          if (!id) break;
          engine.scoreCard(g, p, id);
        }
      }
    }];

    effectDefs.mathematics = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) await drawAndMeld(g, p, ageOf(g, id) + 1);
      }
    }];

    effectDefs.mapmaking = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.hand.filter(function (id) { return hasIcon(g, id, 'crown'); });
        var id = await pickOne(target, ids, 'Transfer a crown card to ' + actor.name + '\'s hand.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          engine.drawCard(g, actor, 1);
        }
      }
    }];

    effectDefs.medicine = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.score.length || !p.hand.length) return;
        var hi = extremeByAge(g, p.score, 'max')[0];
        var lo = extremeByAge(g, p.hand, 'min')[0];
        engine.transferCard(g, hi, { player: p, zone: 'score' }, { player: p, zone: 'hand' });
        engine.transferCard(g, lo, { player: p, zone: 'hand' }, { player: p, zone: 'score' });
      }
    }];

    effectDefs.philosophy = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var colors = COLORS.filter(function (c) { return p.board[c].cards.length > 1 && p.board[c].splay !== 'left'; });
          var color = await pickColor(p, colors, 'Splay a color left?', true);
          if (color) engine.setSplay(g, p, color, 'left');
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), 'Score a card from your hand?', true);
          if (id) engine.scoreCard(g, p, id);
        }
      }
    ];

    effectDefs.monotheism = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var actorColors = COLORS.filter(function (c) { return engine.topCard(actor, c) != null; });
        var ids = topCardsOf(g, target).filter(function (id) { return actorColors.indexOf(colorOf(g, id)) === -1; });
        var id = await pickOne(target, ids, 'Transfer a top card of a color you don\'t share to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          await drawAndTuck(g, actor, 1);
        }
      }
    }];

    effectDefs.road_building = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var boardAges = topCardsOf(g, p).map(function (id) { return ageOf(g, id); });
        var ids = p.hand.filter(function (id) { return boardAges.indexOf(ageOf(g, id) + 1) !== -1; });
        var id = await pickOne(p, ids, 'Meld a card one lower than a board card?', true);
        if (id) engine.meldCard(g, p, id);
      }
    }];

    // ======================================================================
    // AGE 3
    // ======================================================================

    effectDefs.alchemy = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, engine.highestTopValue(ctx.game, ctx.actor) + 1); }
    }];

    effectDefs.compass = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), 'Meld a card from your hand?', true);
        if (id) { engine.meldCard(g, p, id); await drawAndScore(g, p, 3); }
      }
    }];

    effectDefs.education = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, engine.highestTopValue(ctx.game, ctx.actor) + 1); }
    }];

    effectDefs.feudalism = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.hand.filter(function (id) { return hasIcon(g, id, 'castle'); });
        var id = await pickOne(target, ids, 'Transfer a castle card to ' + actor.name + '\'s hand.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          var lo = extremeByAge(g, target.hand, 'min')[0];
          if (lo) engine.scoreCard(g, target, lo);
        }
      }
    }];

    effectDefs.gunpowder = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, topCardsWithIcon(g, target, 'castle'), 'max');
        var id = await pickOne(target, ids, 'Transfer your highest castle top card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          await maybeReturnFromHand(g, target, 'Return a card from your hand?');
        }
      }
    }];

    effectDefs.optics = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = engine.drawCard(g, p, 3);
        if (!id) return;
        if (hasIcon(g, id, 'crown')) {
          engine.scoreCard(g, p, id);
          var id2 = await pickOne(p, p.hand.slice(), 'Meld a card from your hand?', true);
          if (id2) engine.meldCard(g, p, id2);
        } else {
          engine.meldCard(g, p, id);
        }
      }
    }];

    effectDefs.paper = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = p.hand.filter(function (id) { return hasIcon(g, id, 'crown'); });
        var id = await pickOne(p, ids, 'Score a crown card from your hand?', true);
        if (id) {
          var crowns = engine.card(g, id).icons.filter(function (i) { return i === 'crown'; }).length;
          engine.scoreCard(g, p, id);
          for (var i = 0; i < crowns - 1; i++) {
            var extra = await pickOne(p, p.hand.slice(), 'Score an additional card from your hand?', true);
            if (!extra) break;
            engine.scoreCard(g, p, extra);
          }
        }
      }
    }];

    effectDefs.translation = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.score.length) return;
        var hiAge = extremeByAge(g, p.score, 'max').map(function (id) { return ageOf(g, id); })[0];
        var ids = p.score.filter(function (id) { return ageOf(g, id) === hiAge; });
        ids.slice().forEach(function (id) { engine.meldCard(g, p, id); });
        engine.specialAchievementCheck(g, p, 'world');
      }
    }];

    effectDefs.machinery = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var actorIds = extremeByAge(g, topCardsWithIcon(g, actor, 'castle'), 'max');
        var targetIds = extremeByAge(g, topCardsWithIcon(g, target, 'castle'), 'max');
        if (!targetIds.length) { await drawAndMeld(g, actor, 1); return; }
        var aId = await pickOne(actor, actorIds, 'Trade your highest castle top card.', true);
        var tId = await pickOne(target, targetIds, 'Trade your highest castle top card.', true);
        if (aId && tId) {
          var aColor = colorOf(g, aId), tColor = colorOf(g, tId);
          engine.transferCard(g, aId, { player: actor, zone: 'board', color: aColor }, { player: target, zone: 'board', color: aColor });
          engine.transferCard(g, tId, { player: target, zone: 'board', color: tColor }, { player: actor, zone: 'board', color: tColor });
        } else {
          await drawAndMeld(g, actor, 1);
        }
      }
    }];

    effectDefs.colonialism = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) await drawAndTuck(g, p, ageOf(g, id) + 1);
      }
    }];

    effectDefs.vaccination = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) await drawAndScore(g, p, ageOf(g, id) + 1);
      }
    }];

    // ======================================================================
    // AGE 4
    // ======================================================================

    effectDefs.anatomy = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, target.score, 'max');
        var id = await pickOne(target, ids, 'Return a top card from your score pile.', true);
        if (id) {
          engine.returnCardFromPlayer(g, target, id);
          var mine = extremeByAge(g, actor.score, 'min')[0];
          if (mine) engine.returnCardFromPlayer(g, actor, mine);
        }
      }
    }];

    effectDefs.invention = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var colors = COLORS.filter(function (c) { return p.board[c].splay === 'left'; });
          var color = await pickColor(p, colors, 'Splay a left-splayed color right?', true);
          if (color) { engine.setSplay(g, p, color, 'right'); await drawAndScore(g, p, 4); }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (engine.splayedColorCount(p) >= 5) engine.specialAchievementCheck(g, p, 'wonder');
        }
      }
    ];

    effectDefs.navigation = [{
      demand: false, icon: 'crown',
      run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 2); engine.drawCard(ctx.game, ctx.actor, 1); }
    }];

    effectDefs.perspective = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) {
          var scores = Math.floor(engine.iconCount(g, p, 'lightbulb') / 2);
          for (var i = 0; i < scores; i++) {
            var sid = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
            if (!sid) break;
            engine.scoreCard(g, p, sid);
          }
        }
      }
    }];

    effectDefs.printing_press = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.hand.length >= 4 && await yesNo(p, 'Return your whole hand to draw and score a 4 for each?')) {
          var n = p.hand.length;
          p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          for (var i = 0; i < n; i++) await drawAndScore(g, p, 4);
        }
      }
    }];

    effectDefs.reformation = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var colors = ['yellow', 'purple'].filter(function (c) { return p.board[c].cards.length > 1 && p.board[c].splay !== 'left'; });
        var color = await pickColor(p, colors, 'Splay yellow or purple left?', true);
        if (color) {
          engine.setSplay(g, p, color, 'left');
          var leftCount = COLORS.filter(function (c) { return p.board[c].splay === 'left'; }).length;
          var times = Math.floor(leftCount / 2);
          for (var i = 0; i < times; i++) await drawAndScore(g, p, 4);
        }
      }
    }];

    effectDefs.chivalry = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, topCardsOf(g, target), 'max');
        var id = await pickOne(target, ids, 'Transfer your highest top card to ' + actor.name + '\'s board.', true);
        if (id) {
          var a = ageOf(g, id), color = colorOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
          await drawAndTuck(g, actor, a);
          await drawAndTuck(g, target, 1);
        }
      }
    }];

    effectDefs.experimentation = [{ demand: false, icon: 'lightbulb', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 5); } }];

    effectDefs.enterprise = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = topCardsWithIcon(g, target, 'castle');
        var id = await pickOne(target, ids, 'Transfer a top castle card to ' + actor.name + '\'s board.', true);
        if (id) {
          var color = colorOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
          var rid = await maybeReturnFromHand(g, target, 'Return a card from your hand?');
          if (rid) await drawAndMeld(g, target, ageOf(g, rid));
        }
      }
    }];

    // ======================================================================
    // AGE 5
    // ======================================================================

    effectDefs.astronomy = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = p.hand.filter(function (id) { return ageOf(g, id) <= 5; });
        var id = await pickOne(p, ids, 'Return a card of value 5 or less?', true);
        if (id) { var a = ageOf(g, id); engine.returnCardFromPlayer(g, p, id); await drawAndScore(g, p, a + 1); await drawAndScore(g, p, a + 1); }
        engine.specialAchievementCheck(g, p, 'universe');
      }
    }];

    effectDefs.banking = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = extremeByAge(g, topCardsWithIcon(g, p, 'crown'), 'min');
        var id = await pickOne(p, ids, 'Score your lowest top crown card.', true);
        if (id) engine.scoreCard(g, p, id);
        var times = Math.floor(engine.iconCount(g, p, 'crown') / 2);
        for (var i = 0; i < times; i++) {
          var sid = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
          if (!sid) break;
          engine.scoreCard(g, p, sid);
        }
      }
    }];

    effectDefs.chemistry = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) {
          await drawAndMeld(g, p, ageOf(g, id) + 2);
          engine.specialAchievementCheck(g, p, 'wonder');
        }
      }
    }];

    effectDefs.coal = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, target.score, 'max');
        var id = await pickOne(target, ids, 'Transfer your highest score card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
          engine.drawCard(g, actor, 5);
        }
      }
    }];

    effectDefs.measurement = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var opts = splayableColors(p, ['left', 'right', 'up']);
        var choice = await pickSplay(p, opts, 'Splay a color left, right, or up?', true);
        if (choice) { engine.setSplay(g, p, choice.color, choice.direction); engine.drawCard(g, p, 1); }
      }
    }];

    effectDefs.physics = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var drawn = [];
        for (var i = 0; i < 3; i++) { var id = engine.drawCard(g, p, 5); if (id) drawn.push(id); }
        var byColor = {};
        drawn.forEach(function (id) { var c = colorOf(g, id); (byColor[c] = byColor[c] || []).push(id); });
        Object.keys(byColor).forEach(function (c) {
          var group = byColor[c];
          if (group.length < 2) return;
          group.slice(1).forEach(function (id) {
            engine.returnCardFromPlayer(g, p, id);
            engine.drawCard(g, p, ageOf(g, id) + 1);
          });
        });
      }
    }];

    effectDefs.statistics = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = topCardsOf(g, target);
        var id = await pickOne(target, ids, 'Return a top card from your board.', true);
        if (id) {
          engine.returnCardFromPlayer(g, target, id);
          var aids = topCardsOf(g, actor);
          var aid = await pickOne(actor, aids, 'Return a top card from your board.', true);
          if (aid) engine.returnCardFromPlayer(g, actor, aid);
        }
      }
    }];

    effectDefs.pirate_code = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.score.filter(function (id) { return ageOf(g, id) <= 5; });
        ids.slice().forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
        });
      }
    }];

    effectDefs.steam_engine = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var common = COLORS.filter(function (c) { return engine.topCard(actor, c) != null && engine.topCard(target, c) != null; });
        for (var i = 0; i < common.length; i++) {
          var c = common[i];
          var aId = engine.topCard(actor, c), tId = engine.topCard(target, c);
          if (aId == null || tId == null) continue;
          engine.transferCard(g, aId, { player: actor, zone: 'board', color: c }, { player: target, zone: 'board', color: c });
          engine.transferCard(g, tId, { player: target, zone: 'board', color: c }, { player: actor, zone: 'board', color: c });
        }
      }
    }];

    effectDefs.university = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) { await drawAndMeld(g, p, ageOf(g, id) + 1); engine.drawCard(g, p, 1); }
      }
    }];

    // ======================================================================
    // AGE 6
    // ======================================================================

    effectDefs.atomic_theory = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.board.blue.cards.length > 1 && p.board.blue.splay !== 'right' && await yesNo(p, 'Splay your blue cards right?')) {
          engine.setSplay(g, p, 'blue', 'right');
        }
        await drawAndMeld(g, p, 7);
      }
    }];

    effectDefs.classification = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var pool = p.hand.concat(p.score);
        if (!pool.length) return;
        var hiAge = extremeByAge(g, pool, 'max').map(function (id) { return ageOf(g, id); })[0];
        var candidate = pool.filter(function (id) { return ageOf(g, id) === hiAge; })[0];
        var color = colorOf(g, candidate);
        p.hand.filter(function (id) { return colorOf(g, id) === color; }).slice().forEach(function (id) {
          engine.scoreCard(g, p, id);
        });
      }
    }];

    effectDefs.democracy = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), 'Return any number of cards from your hand.', 0, p.hand.length);
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length) { await drawAndMeld(g, p, chosen.length); engine.drawCard(g, p, 8); }
      }
    }];

    effectDefs.encyclopedia = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.hand.length < 2) return;
        var hi = extremeByAge(g, p.hand, 'max')[0];
        engine.meldCard(g, p, hi);
        var lo = extremeByAge(g, p.hand, 'min')[0];
        if (lo) engine.meldCard(g, p, lo);
      }
    }];

    effectDefs.explosives = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var colors = COLORS.filter(function (c) { return engine.topCard(target, c) != null; });
        if (!colors.length) return;
        var loAge = Math.min.apply(null, colors.map(function (c) { return ageOf(g, engine.topCard(target, c)); }));
        var loColor = colors.filter(function (c) { return ageOf(g, engine.topCard(target, c)) === loAge; })[0];
        var id = engine.topCard(target, loColor);
        engine.transferCard(g, id, { player: target, zone: 'board', color: loColor }, { player: actor, zone: 'score' });
        engine.drawCard(g, actor, 6);
      }
    }];

    effectDefs.lensmaking = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var opts = splayableColors(p, ['left']);
        var choice = await pickSplay(p, opts, 'Splay a color left?', true);
        if (choice) { engine.setSplay(g, p, choice.color, choice.direction); await drawAndScore(g, p, 6); }
      }
    }];

    effectDefs.metric_system = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var opts = splayableColors(p, ['right']);
        var choice = await pickSplay(p, opts, 'Splay a color right?', true);
        if (choice) {
          engine.setSplay(g, p, choice.color, choice.direction);
          var n = COLORS.filter(function (c) { return p.board[c].splay === 'right'; }).length;
          await drawAndMeld(g, p, n);
        }
      }
    }];

    effectDefs.emancipation = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var id = await pickOne(target, target.hand.slice(), 'Transfer a card from your hand to ' + actor.name + '.', true);
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'score' });
            engine.drawCard(g, actor, 1);
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['right']).filter(function (o) { return o.color === 'red' || o.color === 'purple'; });
          var choice = await pickSplay(p, opts, 'Splay red or purple cards right?', true);
          if (choice) engine.setSplay(g, p, choice.color, choice.direction);
        }
      }
    ];

    effectDefs.fertilizer = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), 'Return up to two cards from your hand.', 0, Math.min(2, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length) {
          var scores = Math.floor(chosen.length / 2);
          for (var i = 0; i < scores; i++) {
            var sid = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
            if (!sid) break;
            engine.scoreCard(g, p, sid);
          }
          engine.drawCard(g, p, 1);
        }
      }
    }];

    effectDefs.canning = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var id = await pickOne(target, target.score.slice(), 'Transfer a card from your score pile to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
          engine.drawCard(g, actor, 6);
        }
      }
    }];

    // ======================================================================
    // AGE 7
    // ======================================================================

    effectDefs.bicycle = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var times = Math.min(3, Math.floor(engine.iconCount(g, p, 'clock') / 2));
        for (var i = 0; i < times; i++) await drawAndMeld(g, p, 7);
      }
    }];

    effectDefs.combustion = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, topCardsOf(g, target).filter(function (id) { return !hasIcon(g, id, 'castle'); }), 'max');
        var id = await pickOne(target, ids, 'Transfer your highest non-military top card.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          engine.drawCard(g, actor, 7);
        }
      }
    }];

    effectDefs.electricity = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, target = ctx.target;
        var ids = target.score.filter(function (id) { return ageOf(g, id) <= 2; });
        ids.slice().forEach(function (id) { engine.returnCardFromPlayer(g, target, id); });
        for (var i = 0; i < ids.length; i++) engine.drawCard(g, target, 1);
      }
    }];

    effectDefs.evolution = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) {
          await drawAndMeld(g, p, ageOf(g, id) + 2);
        } else {
          await drawAndScore(g, p, 1);
        }
      }
    }];

    effectDefs.lighting = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var opts = splayableColors(p, ['up']);
        var choice = await pickSplay(p, opts, 'Splay a color up?', true);
        if (choice) { engine.setSplay(g, p, choice.color, choice.direction); await drawAndScore(g, p, 7); }
      }
    }];

    effectDefs.publication = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var myScore = engine.scoreValue(g, p);
        var highest = g.players.every(function (o) { return o.id === p.id || myScore >= engine.scoreValue(g, o); });
        if (highest) engine.specialAchievementCheck(g, p, 'wonder');
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand to score a higher one?');
        if (id) await drawAndScore(g, p, ageOf(g, id) + 1);
      }
    }];

    effectDefs.railroad = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var color = await pickColor(p, COLORS.filter(function (c) { return p.hand.some(function (id) { return colorOf(g, id) === c; }); }), 'Meld cards of which color?', true);
        if (!color) return;
        var ids = p.hand.filter(function (id) { return colorOf(g, id) === color; });
        var chosen = await pickSome(p, ids, 'Choose cards of that color to meld.', 1, ids.length);
        chosen.forEach(function (id) { engine.meldCard(g, p, id); });
        if (chosen.length >= 2) await drawAndScore(g, p, chosen.length);
      }
    }];

    effectDefs.refrigeration = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) { await drawAndMeld(g, p, ageOf(g, id) + 1); engine.drawCard(g, p, 1); }
      }
    }];

    effectDefs.sanitation = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), 'Meld a card from your hand?', true);
        if (id) {
          engine.meldCard(g, p, id);
          var ids = extremeByAge(g, topCardsWithIcon(g, p, 'clock'), 'min');
          var sid = await pickOne(p, ids, 'Score your lowest top clock card.', true);
          if (sid) engine.scoreCard(g, p, sid);
        }
      }
    }];

    effectDefs.telegraph = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var common = COLORS.filter(function (c) { return engine.topCard(actor, c) != null && engine.topCard(target, c) != null; });
        var color = await pickColor(actor, common, 'Exchange top card of which shared color?', true);
        if (color) {
          var aId = engine.topCard(actor, color), tId = engine.topCard(target, color);
          engine.transferCard(g, aId, { player: actor, zone: 'board', color: color }, { player: target, zone: 'board', color: color });
          engine.transferCard(g, tId, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
        }
      }
    }];

    // ======================================================================
    // AGE 8
    // ======================================================================

    effectDefs.antibiotics = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var counts = {};
        COLORS.forEach(function (c) { if (engine.topCard(target, c) != null) counts[c] = target.board[c].cards.length; });
        var colors = Object.keys(counts);
        if (!colors.length) return;
        var minCount = Math.min.apply(null, colors.map(function (c) { return counts[c]; }));
        var leastColors = colors.filter(function (c) { return counts[c] === minCount; });
        var color = await pickColor(target, leastColors, 'Which least-represented color to transfer?', true);
        if (color) {
          var id = engine.topCard(target, color);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'score' });
          engine.drawCard(g, actor, 8);
        }
      }
    }];

    effectDefs.corporations = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), 'Return up to three cards from your hand.', 0, Math.min(3, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length) await drawAndMeld(g, p, chosen.length);
      }
    }];

    effectDefs.empiricism = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var myColors = COLORS.filter(function (c) { return engine.topCard(p, c) != null; });
        var revealed = [];
        var found = null;
        for (;;) {
          var age = 0;
          for (var a = 1; a <= 10; a++) { if (g.piles[a] && g.piles[a].length) { age = a; break; } }
          if (!age) break;
          var id = g.piles[age].pop();
          revealed.push(id);
          if (myColors.indexOf(colorOf(g, id)) !== -1) { found = id; break; }
        }
        revealed.forEach(function (id) {
          if (id === found) return;
          g.piles[ageOf(g, id)].unshift(id);
        });
        if (found) { p.hand.push(found); engine.meldCard(g, p, found); }
      }
    }];

    effectDefs.refining = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var colors = COLORS.filter(function (c) { return engine.topCard(p, c) != null; });
        if (!colors.length) return;
        var hiAge = Math.max.apply(null, colors.map(function (c) { return ageOf(g, engine.topCard(p, c)); }));
        var hiColors = colors.filter(function (c) { return ageOf(g, engine.topCard(p, c)) === hiAge; });
        var color = await pickColor(p, hiColors, 'Which highest-value color?', true);
        if (!color) return;
        var n = p.board[color].cards.length;
        for (var i = 0; i < n; i++) {
          var ids = p.hand.filter(function (id) { return colorOf(g, id) === color; });
          var id = await pickOne(p, ids, 'Score a ' + color + ' card from your hand?', true);
          if (!id) break;
          engine.scoreCard(g, p, id);
        }
      }
    }];

    effectDefs.flight = [{ demand: false, icon: 'clock', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 9); } }];

    effectDefs.mass_media = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.hand.length < 2) return;
        if (await yesNo(p, 'Return your two lowest cards to draw and score an 8?')) {
          var sorted = p.hand.slice().sort(function (a, b) { return ageOf(g, a) - ageOf(g, b); });
          [sorted[0], sorted[1]].forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          await drawAndScore(g, p, 8);
        }
      }
    }];

    effectDefs.skyscrapers = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = p.hand.filter(function (id) { return hasIcon(g, id, 'castle') || hasIcon(g, id, 'factory'); });
        var id = await pickOne(p, ids, 'Meld a castle/factory card from your hand?', true);
        if (id) { engine.meldCard(g, p, id); await drawAndScore(g, p, 8); }
      }
    }];

    effectDefs.quantum_theory = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.hand.length < 2) return;
        var sorted = p.hand.slice().sort(function (a, b) { return ageOf(g, a) - ageOf(g, b); });
        var low = [sorted[0], sorted[1]];
        var higherAge = Math.max(ageOf(g, low[0]), ageOf(g, low[1]));
        low.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        await drawAndMeld(g, p, higherAge + 1);
      }
    }];

    effectDefs.socialism = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var candidates = g.players.filter(function (o) { return o.id !== p.id && o.hand.length < p.hand.length; });
        if (!candidates.length) return;
        var otherId = await p.controller.choosePlayer(p, { ids: candidates.map(function (o) { return o.id; }), prompt: 'Exchange hands with whom?' });
        if (otherId == null) return;
        var other = g.players[otherId];
        var tmp = p.hand; p.hand = other.hand; other.hand = tmp;
        engine.log(g, p.name + ' exchanges hands with ' + other.name + '.');
      }
    }];

    effectDefs.rocketry = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, target.hand, 'max');
        var id = await pickOne(target, ids, 'Transfer your highest hand card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          engine.drawCard(g, actor, 8);
        }
      }
    }];

    // ======================================================================
    // AGE 9
    // ======================================================================

    effectDefs.collaboration = [{
      demand: false, icon: 'clock',
      run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 9); }
    }];

    effectDefs.composites = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        for (var i = 0; i < 3; i++) {
          var ids = extremeByAge(g, p.hand, 'max');
          var id = await pickOne(p, ids, 'Return your highest hand card to draw and score a 9?', true);
          if (!id) break;
          engine.returnCardFromPlayer(g, p, id);
          await drawAndScore(g, p, 9);
        }
      }
    }];

    effectDefs.computers = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), 'Meld a card from your hand?', true);
        if (id) { engine.meldCard(g, p, id); await drawAndMeld(g, p, 10); }
      }
    }];

    effectDefs.ecology = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var actorColors = COLORS.filter(function (c) { return engine.topCard(actor, c) != null; });
        var ids = topCardsOf(g, target).filter(function (id) { return ageOf(g, id) <= 8 && actorColors.indexOf(colorOf(g, id)) !== -1; });
        ids.slice().forEach(function (id) { engine.returnCardFromPlayer(g, target, id); });
        for (var i = 0; i < ids.length; i++) engine.drawCard(g, target, 9);
      }
    }];

    effectDefs.fission = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var castleTops = topCardsWithIcon(g, target, 'castle');
        if (castleTops.length >= 2) {
          g.players.forEach(function (pl) {
            pl.hand.slice().forEach(function (id) { engine.removeCardFromPlayer(g, pl, id); });
            pl.score.slice().forEach(function (id) { engine.removeCardFromPlayer(g, pl, id); });
            COLORS.forEach(function (c) { pl.board[c].cards.slice().forEach(function (id) { engine.removeCardFromPlayer(g, pl, id); }); });
          });
          for (var i = 0; i < g.players.length; i++) await drawAndMeld(g, g.players[i], 10);
        } else {
          await drawAndMeld(g, actor, 10);
        }
      }
    }];

    effectDefs.satellites = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        p.score.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        engine.drawCard(g, p, 9); engine.drawCard(g, p, 9); engine.drawCard(g, p, 9);
      }
    }];

    effectDefs.specialization = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var counts = {};
        COLORS.forEach(function (c) { counts[c] = p.board[c].cards.length; });
        var maxN = Math.max.apply(null, COLORS.map(function (c) { return counts[c]; }));
        if (maxN === 0) return;
        var mainColors = COLORS.filter(function (c) { return counts[c] === maxN; });
        var revealed = COLORS.filter(function (c) { return engine.topCard(p, c) != null; });
        var matches = revealed.filter(function (c) { return mainColors.indexOf(c) !== -1; }).length;
        for (var i = 0; i < matches; i++) {
          var id = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
          if (!id) break;
          engine.scoreCard(g, p, id);
        }
      }
    }];

    effectDefs.radio = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var revealed = [];
        var found = null;
        for (;;) {
          var age = 0;
          for (var a = 1; a <= 10; a++) { if (g.piles[a] && g.piles[a].length) { age = a; break; } }
          if (!age) break;
          var id = g.piles[age].pop();
          revealed.push(id);
          if (age === 10) { found = id; break; }
        }
        revealed.forEach(function (id) {
          if (id === found) return;
          g.piles[ageOf(g, id)].unshift(id);
        });
        if (found) { p.score.push(found); engine.log(g, p.name + ' scores ' + engine.card(g, found).name); }
      }
    }];

    effectDefs.telephone = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await maybeReturnFromHand(g, p, 'Return a card from your hand?');
        if (id) { var a = ageOf(g, id) + 1; await drawAndScore(g, p, a); await drawAndScore(g, p, a); }
      }
    }];

    effectDefs.suburbia = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), 'Meld a card from your hand?', true);
        if (id) {
          engine.meldCard(g, p, id);
          var qualifying = COLORS.filter(function (c) { return p.board[c].cards.length >= 3; }).length;
          for (var i = 0; i < qualifying; i++) {
            var sid = await pickOne(p, p.hand.slice(), 'Score a card from your hand.', true);
            if (!sid) break;
            engine.scoreCard(g, p, sid);
          }
        }
      }
    }];

    // ======================================================================
    // AGE 10
    // ======================================================================

    effectDefs.artificial_intelligence = [{
      demand: false, icon: 'clock',
      run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 10); }
    }];

    effectDefs.bioengineering = [{
      demand: false, icon: 'clock',
      run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 10); }
    }];

    effectDefs.globalization = [{
      demand: false, icon: 'clock',
      run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 10); }
    }];

    effectDefs.miniaturization = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, topCardsOf(g, target), 'min');
        var id = await pickOne(target, ids, 'Transfer your lowest top card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          engine.drawCard(g, actor, 1);
        }
      }
    }];

    effectDefs.robotics = [{ demand: false, icon: 'clock', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 10); } }];
    effectDefs.self_service = [{ demand: false, icon: 'clock', run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 1); } }];
    effectDefs.software10 = [{ demand: false, icon: 'clock', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 10); } }];

    effectDefs.stem_cells10 = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = extremeByAge(g, target.hand, 'max');
        var id = await pickOne(target, ids, 'Transfer your highest hand card to ' + actor.name + '.', true);
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          engine.drawCard(g, actor, 10);
        }
      }
    }];

    effectDefs.the_internet = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var colors = COLORS.filter(function (c) { return engine.topCard(p, c) != null; });
        var options = [];
        colors.forEach(function (c) {
          g.players.forEach(function (o) {
            if (o.id === p.id) return;
            if (engine.topCard(o, c) != null) options.push(c);
          });
        });
        var color = await pickColor(p, options, 'Exchange your top card with another player\'s lowest top card of the same color?', true);
        if (!color) return;
        var others = g.players.filter(function (o) { return o.id !== p.id && engine.topCard(o, color) != null; });
        var lowestOther = null, lowestAge = Infinity, lowestPlayer = null;
        others.forEach(function (o) {
          var a = ageOf(g, engine.topCard(o, color));
          if (a < lowestAge) { lowestAge = a; lowestOther = engine.topCard(o, color); lowestPlayer = o; }
        });
        if (!lowestOther) return;
        var mine = engine.topCard(p, color);
        engine.transferCard(g, mine, { player: p, zone: 'board', color: color }, { player: lowestPlayer, zone: 'board', color: color });
        engine.transferCard(g, lowestOther, { player: lowestPlayer, zone: 'board', color: color }, { player: p, zone: 'board', color: color });
      }
    }];

    effectDefs.nanotechnology = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var times = Math.min(3, Math.floor(engine.iconCount(g, p, 'factory') / 2));
        for (var i = 0; i < times; i++) await drawAndScore(g, p, 10);
      }
    }];

    return effectDefs;
  };
});
