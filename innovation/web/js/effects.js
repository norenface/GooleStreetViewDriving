// Innovation dogma effect implementations — BGA 3rd edition, all 105 base-game cards.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationEffects = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return function (engine) {
    var COLORS = engine.COLORS;
    var COLOR_JA = { yellow: '黄', red: '赤', green: '緑', blue: '青', purple: '紫' };

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
    function distinctValues(game, ids) {
      var seen = {};
      ids.forEach(function (id) { seen[ageOf(game, id)] = true; });
      return Object.keys(seen).length;
    }

    async function pickOne(player, ids, prompt, optional) {
      if (!ids.length) return null;
      if (ids.length === 1 && !optional) return ids[0];
      var res = await player.controller.chooseCard(player, { ids: ids, prompt: prompt, min: optional ? 0 : 1, max: 1 });
      return res && res.length ? res[0] : null;
    }
    async function pickSome(player, ids, prompt, min, max) {
      if (!ids.length) return [];
      var res = await player.controller.chooseCard(player, { ids: ids, prompt: prompt, min: min == null ? 0 : min, max: max == null ? ids.length : max });
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

    effectDefs.pottery = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から最大3枚のカードを戻してください。', 0, Math.min(3, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length) await drawAndScore(g, p, chosen.length);
      }
    }];

    effectDefs.tools = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.hand.length >= 3 && await yesNo(p, '手札から3枚戻して3を引いてメルドしますか？')) {
            var chosen = await pickSome(p, p.hand.slice(), '戻すカードを3枚選んでください。', 3, 3);
            chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
            await drawAndMeld(g, p, 3);
          }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var threes = p.hand.filter(function (id) { return ageOf(g, id) === 3; });
          var id = await pickOne(p, threes, '手札から3を戻して1を3枚引きますか？', true);
          if (id) {
            engine.returnCardFromPlayer(g, p, id);
            engine.drawCard(g, p, 1); engine.drawCard(g, p, 1); engine.drawCard(g, p, 1);
          }
        }
      }
    ];

    effectDefs.writing = [{ demand: false, icon: 'lightbulb', run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 2); } }];

    effectDefs.archery = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, target = ctx.target, actor = ctx.actor;
        if (!target.hand.length) return;
        var highest = extremeByAge(g, target.hand, 'max');
        var id = await pickOne(target, highest, actor.name + ' に手札の最高値カードを渡してください。');
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          engine.drawCard(g, target, 1);
        }
      }
    }];

    effectDefs.metalworking = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        for (;;) {
          var id = engine.drawCard(g, p, 1);
          if (!id) return;
          if (hasIcon(g, id, 'castle')) engine.scoreCard(g, p, id);
          else return;
        }
      }
    }];

    effectDefs.oars = [{
      demand: true, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.hand.filter(function (id) { return hasIcon(g, id, 'crown'); });
        var id = await pickOne(target, ids, actor.name + ' に王冠アイコン付きカードを渡してください。');
        if (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'score' });
          engine.drawCard(g, target, 1);
          await effectDefs.oars[0].run(ctx);
        } else {
          engine.drawCard(g, actor, 1);
        }
      }
    }];

    effectDefs.clothing = [
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var boardColors = {};
          COLORS.forEach(function (c) { if (engine.topCard(p, c) != null) boardColors[c] = true; });
          var ids = p.hand.filter(function (id) { return !boardColors[colorOf(g, id)]; });
          var id = await pickOne(p, ids, 'ボードにない色のカードをメルドしてください。');
          if (id) engine.meldCard(g, p, id);
        }
      },
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var myColors = COLORS.filter(function (c) { return engine.topCard(p, c) != null; });
          var opponentColors = {};
          g.players.forEach(function (o) {
            if (o.id === p.id) return;
            COLORS.forEach(function (c) { if (engine.topCard(o, c) != null) opponentColors[c] = true; });
          });
          var exclusive = myColors.filter(function (c) { return !opponentColors[c]; });
          for (var i = 0; i < exclusive.length; i++) await drawAndScore(g, p, 1);
        }
      }
    ];

    effectDefs.sailing = [{ demand: false, icon: 'crown', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 1); } }];

    effectDefs.the_wheel = [{
      demand: false, icon: 'castle',
      run: async function (ctx) { engine.drawCard(ctx.game, ctx.actor, 1); engine.drawCard(ctx.game, ctx.actor, 1); }
    }];

    effectDefs.agriculture = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) { var a = ageOf(g, id); engine.returnCardFromPlayer(g, p, id); await drawAndScore(g, p, a + 1); }
      }
    }];

    effectDefs.domestication = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var lowest = extremeByAge(g, p.hand, 'min');
        var id = await pickOne(p, lowest, '手札の最低値カードをメルドしてください。');
        if (id) { engine.meldCard(g, p, id); engine.drawCard(g, p, 1); }
      }
    }];

    effectDefs.masonry = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var ids = p.hand.filter(function (id) { return hasIcon(g, id, 'castle'); });
        var chosen = await pickSome(p, ids, '城アイコンのカードを好きな数メルドしてください。', 0, ids.length);
        chosen.forEach(function (id) { engine.meldCard(g, p, id); });
        if (chosen.length >= 4) engine.claimSpecialAchievement(g, p, 'monument');
      }
    }];

    effectDefs.city_states = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, target = ctx.target, actor = ctx.actor;
        if (engine.iconCount(g, target, 'castle') < 4) return;
        var ids = topCardsWithIcon(g, target, 'castle');
        var id = await pickOne(target, ids, actor.name + ' のボードに城アイコン付き一番上のカードを渡してください。');
        if (id) {
          var color = colorOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
          engine.drawCard(g, target, 1);
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
        var id = await pickOne(p, ids, '一番上のカードと同じ色のカードをタックしますか？', true);
        if (id) {
          var c = colorOf(g, id);
          engine.tuckCard(g, p, id);
          if (p.board[c].cards.length >= 2 && await yesNo(p, (COLOR_JA[c] || c) + ' を左にスプレイしますか？')) engine.setSplay(g, p, c, 'left');
        }
      }
    }];

    effectDefs.mysticism = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = engine.drawCard(g, p, 1);
        if (!id) return;
        var c = colorOf(g, id);
        if (engine.topCard(p, c) != null) { engine.meldCard(g, p, id); engine.drawCard(g, p, 1); }
      }
    }];

    // ======================================================================
    // AGE 2
    // ======================================================================

    effectDefs.calendar = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (p.score.length > p.hand.length) { await drawAndScore(g, p, 3); await drawAndScore(g, p, 3); }
      }
    }];

    effectDefs.mathematics = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) { var a = ageOf(g, id); engine.returnCardFromPlayer(g, p, id); await drawAndMeld(g, p, a + 1); }
      }
    }];

    effectDefs.construction = [
      {
        demand: true, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var chosen = await pickSome(target, target.hand.slice(), actor.name + ' の手札に2枚渡してください。', Math.min(2, target.hand.length), Math.min(2, target.hand.length));
          chosen.forEach(function (id) {
            engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          });
          engine.drawCard(g, target, 2);
        }
      },
      {
        demand: false, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var myTopCount = COLORS.filter(function (c) { return engine.topCard(p, c) != null; }).length;
          if (myTopCount < 5) return;
          var alone = g.players.every(function (o) {
            return o.id === p.id || COLORS.filter(function (c) { return engine.topCard(o, c) != null; }).length < 5;
          });
          if (alone) engine.claimSpecialAchievement(g, p, 'empire');
        }
      }
    ];

    effectDefs.road_building = [{
      demand: false, icon: 'castle',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から1〜2枚のカードをメルドしてください。', 1, Math.min(2, p.hand.length));
        chosen.forEach(function (id) { engine.meldCard(g, p, id); });
        if (chosen.length >= 2) {
          var myRed = engine.topCard(p, 'red');
          if (myRed && await yesNo(p, '自分の赤の一番上のカードを対戦相手のボードに渡しますか？')) {
            var others = g.players.filter(function (o) { return o.id !== p.id; });
            if (others.length) {
              var otherId = await p.controller.choosePlayer(p, { ids: others.map(function (o) { return o.id; }), prompt: '渡す相手を選んでください。' });
              var other = g.players.find ? g.players.find(function (o) { return o.id === otherId; }) : g.players[otherId];
              if (other) {
                engine.transferCard(g, myRed, { player: p, zone: 'board', color: 'red' }, { player: other, zone: 'board', color: 'red' });
                var theirGreen = engine.topCard(other, 'green');
                if (theirGreen) engine.transferCard(g, theirGreen, { player: other, zone: 'board', color: 'green' }, { player: p, zone: 'hand' });
              }
            }
          }
        }
      }
    }];

    effectDefs.currency = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から好きな数のカードを戻してください。', 0, p.hand.length);
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (!chosen.length) return;
        var n = distinctValues(g, chosen);
        for (var i = 0; i < n; i++) await drawAndScore(g, p, 2);
      }
    }];

    effectDefs.mapmaking = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = target.score.filter(function (id) { return ageOf(g, id) === 1; });
          var id = await pickOne(target, ids, actor.name + ' の得点パイルに価値1のカードを渡してください。');
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
            ctx._mapmaking_transferred = (ctx._mapmaking_transferred || 0) + 1;
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          if (ctx._mapmaking_transferred) await drawAndScore(ctx.game, ctx.actor, 1);
        }
      }
    ];

    effectDefs.canal_building = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (await yesNo(p, '手札と得点パイルをすべて交換しますか？')) {
          var tmp = p.hand; p.hand = p.score; p.score = tmp;
          engine.log(g, p.name + ' は手札と得点パイルを交換した');
        }
      }
    }];

    effectDefs.fermenting = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var times = Math.floor(engine.iconCount(g, p, 'leaf') / 2);
        for (var i = 0; i < times; i++) engine.drawCard(g, p, 2);
      }
    }];

    effectDefs.monotheism = [
      {
        demand: true, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var actorColors = COLORS.filter(function (c) { return engine.topCard(actor, c) != null; });
          var ids = topCardsOf(g, target).filter(function (id) { return actorColors.indexOf(colorOf(g, id)) === -1; });
          var id = await pickOne(target, ids, actor.name + ' に共有していない色の一番上のカードを渡してください。');
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
            await drawAndTuck(g, target, 1);
          }
        }
      },
      {
        demand: false, icon: 'castle',
        run: async function (ctx) { await drawAndTuck(ctx.game, ctx.actor, 1); }
      }
    ];

    effectDefs.philosophy = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['left']);
          var choice = await pickSplay(p, opts, '色を左にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'left');
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), '手札からカードを得点しますか？', true);
          if (id) engine.scoreCard(g, p, id);
        }
      }
    ];

    // ======================================================================
    // AGE 3
    // ======================================================================

    effectDefs.alchemy = [
      {
        demand: false, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var times = Math.floor(engine.iconCount(g, p, 'castle') / 3);
          var drawn = [];
          for (var i = 0; i < times; i++) {
            var id = engine.drawCard(g, p, 4);
            if (id) drawn.push(id);
          }
          var anyRed = drawn.some(function (id) { return colorOf(g, id) === 'red'; });
          if (anyRed) {
            drawn.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
            p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          }
        }
      },
      {
        demand: false, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var meld = await pickOne(p, p.hand.slice(), '手札からカードをメルドしてください。', true);
          if (meld) engine.meldCard(g, p, meld);
          var score = await pickOne(p, p.hand.slice(), '手札からカードを得点してください。', true);
          if (score) engine.scoreCard(g, p, score);
        }
      }
    ];

    effectDefs.translation = [
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (!p.score.length) return;
          if (await yesNo(p, '得点パイルのカードをすべてメルドしますか？')) {
            p.score.slice().forEach(function (id) { engine.meldCard(g, p, id); });
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var tops = topCardsOf(g, p);
          if (tops.length > 0 && tops.every(function (id) { return hasIcon(g, id, 'crown'); })) {
            engine.claimSpecialAchievement(g, p, 'world');
          }
        }
      }
    ];

    effectDefs.engineering = [
      {
        demand: true, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = topCardsWithIcon(g, target, 'castle').slice();
          ids.forEach(function (id) {
            engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
          });
        }
      },
      {
        demand: false, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.red.cards.length >= 2 && p.board.red.splay !== 'left' && await yesNo(p, '赤を左にスプレイしますか？')) {
            engine.setSplay(g, p, 'red', 'left');
          }
        }
      }
    ];

    effectDefs.optics = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await drawAndMeld(g, p, 3);
        if (!id) return;
        if (hasIcon(g, id, 'crown')) {
          await drawAndScore(g, p, 4);
        } else {
          if (!p.score.length) return;
          var others = g.players.filter(function (o) { return o.id !== p.id && engine.scoreValue(g, o) < engine.scoreValue(g, p); });
          if (!others.length) return;
          var otherId = await p.controller.choosePlayer(p, { ids: others.map(function (o) { return o.id; }), prompt: '得点パイルからカードを渡す相手を選んでください。' });
          var other = g.players.find ? g.players.find(function (o) { return o.id === otherId; }) : g.players[otherId];
          if (!other) return;
          var sid = await pickOne(p, p.score.slice(), '得点パイルから渡すカードを選んでください。');
          if (sid) engine.transferCard(g, sid, { player: p, zone: 'score' }, { player: other, zone: 'score' });
        }
      }
    }];

    effectDefs.compass = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var targetLeafNonGreen = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'green' && hasIcon(g, id, 'leaf'); });
        var tId = await pickOne(target, targetLeafNonGreen, actor.name + ' のボードに葉アイコン付き（緑以外）の一番上のカードを渡してください。');
        if (tId) engine.transferCard(g, tId, { player: target, zone: 'board', color: colorOf(g, tId) }, { player: actor, zone: 'board', color: colorOf(g, tId) });
        var actorNoLeaf = topCardsOf(g, actor).filter(function (id) { return !hasIcon(g, id, 'leaf'); });
        var aId = await pickOne(actor, actorNoLeaf, target.name + ' のボードに葉アイコンのない一番上のカードを渡してください。');
        if (aId) engine.transferCard(g, aId, { player: actor, zone: 'board', color: colorOf(g, aId) }, { player: target, zone: 'board', color: colorOf(g, aId) });
      }
    }];

    effectDefs.paper = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['left']).filter(function (o) { return o.color === 'green' || o.color === 'blue'; });
          var choice = await pickSplay(p, opts, '緑か青を左にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'left');
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var leftCount = COLORS.filter(function (c) { return p.board[c].splay === 'left'; }).length;
          for (var i = 0; i < leftCount; i++) engine.drawCard(g, p, 4);
        }
      }
    ];

    effectDefs.machinery = [{
      demand: true, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var actorIds = extremeByAge(g, topCardsWithIcon(g, actor, 'castle'), 'max');
        var targetIds = extremeByAge(g, topCardsWithIcon(g, target, 'castle'), 'max');
        if (!targetIds.length) { await drawAndMeld(g, actor, 1); return; }
        var aId = await pickOne(actor, actorIds, '一番上の城カードのうち最高値のものを交換してください。');
        var tId = await pickOne(target, targetIds, '一番上の城カードのうち最高値のものを交換してください。');
        if (aId && tId) {
          var aC = colorOf(g, aId), tC = colorOf(g, tId);
          engine.transferCard(g, aId, { player: actor, zone: 'board', color: aC }, { player: target, zone: 'board', color: aC });
          engine.transferCard(g, tId, { player: target, zone: 'board', color: tC }, { player: actor, zone: 'board', color: tC });
        } else {
          await drawAndMeld(g, actor, 1);
        }
      }
    }];

    effectDefs.medicine = [{
      demand: true, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        if (!target.score.length || !actor.score.length) return;
        var hiIds = extremeByAge(g, target.score, 'max');
        var hi = await pickOne(target, hiIds, '得点パイルの最高値カードを交換してください。');
        var loIds = extremeByAge(g, actor.score, 'min');
        var lo = loIds[0];
        if (hi && lo) {
          engine.transferCard(g, hi, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
          engine.transferCard(g, lo, { player: actor, zone: 'score' }, { player: target, zone: 'score' });
        }
      }
    }];

    effectDefs.education = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.score.length) return;
        var hiIds = extremeByAge(g, p.score, 'max');
        var id = await pickOne(p, hiIds, '得点パイルの最高値カードを戻しますか？', true);
        if (id) {
          engine.returnCardFromPlayer(g, p, id);
          var newHi = p.score.length ? ageOf(g, extremeByAge(g, p.score, 'max')[0]) : 0;
          engine.drawCard(g, p, newHi + 2);
        }
      }
    }];

    effectDefs.feudalism = [
      {
        demand: true, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = target.hand.filter(function (id) { return hasIcon(g, id, 'castle'); });
          var id = await pickOne(target, ids, actor.name + ' の手札に城カードを渡してください。');
          if (id) engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
        }
      },
      {
        demand: false, icon: 'castle',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['left']).filter(function (o) { return o.color === 'yellow' || o.color === 'purple'; });
          var choice = await pickSplay(p, opts, '黄か紫を左にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'left');
        }
      }
    ];

    // ======================================================================
    // AGE 4
    // ======================================================================

    effectDefs.experimentation = [{ demand: false, icon: 'lightbulb', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 5); } }];

    effectDefs.printing_press = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.score.slice(), '得点パイルからカードを1枚戻しますか？', true);
          if (id) {
            engine.returnCardFromPlayer(g, p, id);
            var purpleTops = topCardsOf(g, p).filter(function (x) { return colorOf(g, x) === 'purple'; });
            if (purpleTops.length) {
              var purpleAge = ageOf(g, purpleTops[0]);
              engine.drawCard(g, p, purpleAge + 2);
            }
          }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.blue.cards.length >= 2 && p.board.blue.splay !== 'right' && await yesNo(p, '青を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'blue', 'right');
          }
        }
      }
    ];

    effectDefs.colonialism = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        for (;;) {
          var id = await drawAndTuck(g, p, 3);
          if (!id) return;
          if (!hasIcon(g, id, 'crown')) return;
        }
      }
    }];

    effectDefs.gunpowder = [
      {
        demand: true, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = extremeByAge(g, topCardsWithIcon(g, target, 'castle'), 'max');
          var id = await pickOne(target, ids, actor.name + ' に城アイコン付き一番上のカードのうち最高値のものを渡してください。');
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
            var rid = await pickOne(target, target.hand.slice(), '手札からカードを1枚戻しますか？', true);
            if (rid) engine.returnCardFromPlayer(g, target, rid);
            ctx._gunpowder_transferred = true;
          }
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          if (ctx._gunpowder_transferred) await drawAndScore(ctx.game, ctx.actor, 2);
        }
      }
    ];

    effectDefs.invention = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['right']).filter(function (o) { return p.board[o.color].splay === 'left'; });
          var choice = await pickSplay(p, opts, '左スプレイの色を右にスプレイしますか？', true);
          if (choice) { engine.setSplay(g, p, choice.color, 'right'); await drawAndScore(g, p, 4); }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var splayed = COLORS.filter(function (c) { return p.board[c].splay && p.board[c].splay !== 'none'; }).length;
          if (splayed >= 5) engine.claimSpecialAchievement(g, p, 'wonder');
        }
      }
    ];

    effectDefs.navigation = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = target.score.filter(function (id) { return ageOf(g, id) === 2 || ageOf(g, id) === 3; });
        var id = await pickOne(target, ids, actor.name + ' に得点パイルから価値2または3のカードを渡してください。');
        if (id) engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
      }
    }];

    effectDefs.anatomy = [{
      demand: true, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var sid = await pickOne(target, target.score.slice(), '得点パイルからカードを1枚戻してください。');
        if (sid) {
          var a = ageOf(g, sid);
          engine.returnCardFromPlayer(g, target, sid);
          var boardIds = topCardsOf(g, target).filter(function (id) { return ageOf(g, id) === a; });
          var bid = await pickOne(target, boardIds, 'ボードの同じ価値のカードも戻してください。');
          if (bid) engine.returnCardFromPlayer(g, target, bid);
        }
      }
    }];

    effectDefs.perspective = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) {
          engine.returnCardFromPlayer(g, p, id);
          var times = Math.floor(engine.iconCount(g, p, 'lightbulb') / 2);
          for (var i = 0; i < times; i++) {
            var sid = await pickOne(p, p.hand.slice(), '手札からカードを得点してください。', true);
            if (!sid) break;
            engine.scoreCard(g, p, sid);
          }
        }
      }
    }];

    effectDefs.enterprise = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'purple' && hasIcon(g, id, 'crown'); });
          var id = await pickOne(target, ids, actor.name + ' のボードに王冠アイコン付きの紫以外の一番上のカードを渡してください。');
          if (id) {
            var color = colorOf(g, id);
            engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
            await drawAndMeld(g, target, 4);
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.green.cards.length >= 2 && p.board.green.splay !== 'right' && await yesNo(p, '緑を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'green', 'right');
          }
        }
      }
    ];

    effectDefs.reformation = [
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var times = Math.floor(engine.iconCount(g, p, 'leaf') / 2);
          for (var i = 0; i < times; i++) {
            var id = await pickOne(p, p.hand.slice(), '手札からカードをタックしてください。', true);
            if (!id) break;
            engine.tuckCard(g, p, id);
          }
        }
      },
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var times = Math.floor(engine.iconCount(g, p, 'leaf') / 2);
          for (var i = 0; i < times; i++) {
            var id = await pickOne(p, p.hand.slice(), '手札からカードをタックしてください。', true);
            if (!id) break;
            engine.tuckCard(g, p, id);
          }
        }
      }
    ];

    // ======================================================================
    // AGE 5
    // ======================================================================

    effectDefs.chemistry = [
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.blue.cards.length >= 2 && p.board.blue.splay !== 'right' && await yesNo(p, '青を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'blue', 'right');
          }
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var tops = topCardsOf(g, p);
          if (!tops.length) return;
          var hiAge = Math.max.apply(null, tops.map(function (id) { return ageOf(g, id); }));
          await drawAndScore(g, p, hiAge + 1);
          var rid = await pickOne(p, p.score.slice(), '得点パイルからカードを1枚戻してください。', true);
          if (rid) engine.returnCardFromPlayer(g, p, rid);
        }
      }
    ];

    effectDefs.physics = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var drawn = [];
        for (var i = 0; i < 3; i++) { var id = engine.drawCard(g, p, 6); if (id) drawn.push(id); }
        var colorCounts = {};
        drawn.forEach(function (id) { var c = colorOf(g, id); colorCounts[c] = (colorCounts[c] || 0) + 1; });
        var hasDup = Object.keys(colorCounts).some(function (c) { return colorCounts[c] >= 2; });
        if (hasDup) {
          drawn.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        }
      }
    }];

    effectDefs.coal = [
      { demand: false, icon: 'factory', run: async function (ctx) { await drawAndTuck(ctx.game, ctx.actor, 5); } },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.red.cards.length >= 2 && p.board.red.splay !== 'right' && await yesNo(p, '赤を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'red', 'right');
          }
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var tops = topCardsOf(g, p);
          var id = await pickOne(p, tops, '一番上のカードを得点しますか？', true);
          if (id) {
            var color = colorOf(g, id);
            engine.scoreCard(g, p, id);
            var beneath = engine.topCard(p, color);
            if (beneath) engine.scoreCard(g, p, beneath);
          }
        }
      }
    ];

    effectDefs.pirate_code = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var eligible = target.score.filter(function (id) { return ageOf(g, id) <= 4; });
        var chosen = await pickSome(target, eligible, actor.name + ' に価値4以下のカードを2枚渡してください。', Math.min(2, eligible.length), Math.min(2, eligible.length));
        chosen.forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
        });
      }
    }];

    effectDefs.banking = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'green' && hasIcon(g, id, 'factory'); });
          var id = await pickOne(target, ids, actor.name + ' のボードに工場アイコン付き（緑以外）の一番上のカードを渡してください。');
          if (id) {
            var color = colorOf(g, id);
            engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
            await drawAndScore(g, target, 5);
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.green.cards.length >= 2 && p.board.green.splay !== 'right' && await yesNo(p, '緑を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'green', 'right');
          }
        }
      }
    ];

    effectDefs.measurement = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) {
          engine.returnCardFromPlayer(g, p, id);
          var colors = COLORS.filter(function (c) { return p.board[c].cards.length > 0; });
          var color = await pickColor(p, colors, '色を選んで右にスプレイします。');
          if (color) {
            engine.setSplay(g, p, color, 'right');
            var count = p.board[color].cards.length;
            engine.drawCard(g, p, count);
          }
        }
      }
    }];

    effectDefs.statistics = [
      {
        demand: true, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          if (!target.score.length) return;
          var hiAge = ageOf(g, extremeByAge(g, target.score, 'max')[0]);
          var ids = target.score.filter(function (id) { return ageOf(g, id) === hiAge; }).slice();
          ids.forEach(function (id) {
            engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'hand' });
          });
        }
      },
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.yellow.cards.length >= 2 && p.board.yellow.splay !== 'right' && await yesNo(p, '黄を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'yellow', 'right');
          }
        }
      }
    ];

    effectDefs.steam_engine = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        await drawAndTuck(g, p, 4);
        await drawAndTuck(g, p, 4);
        var yellowCards = p.board.yellow.cards;
        if (yellowCards.length) engine.scoreCard(g, p, yellowCards[0]); // bottom card = index 0
      }
    }];

    effectDefs.astronomy = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          for (;;) {
            var id = engine.drawCard(g, p, 6);
            if (!id) return;
            var c = colorOf(g, id);
            if (c === 'green' || c === 'blue') { engine.meldCard(g, p, id); }
            else { return; }
          }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var nonPurpleTops = topCardsOf(g, p).filter(function (id) { return colorOf(g, id) !== 'purple'; });
          if (nonPurpleTops.length && nonPurpleTops.every(function (id) { return ageOf(g, id) >= 6; })) {
            engine.claimSpecialAchievement(g, p, 'universe');
          }
        }
      }
    ];

    effectDefs.societies = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'purple' && hasIcon(g, id, 'lightbulb'); });
        var id = await pickOne(target, ids, actor.name + ' のボードに電球アイコン付き（紫以外）の一番上のカードを渡してください。');
        if (id) {
          var color = colorOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
          engine.drawCard(g, target, 5);
        }
      }
    }];

    // ======================================================================
    // AGE 6
    // ======================================================================

    effectDefs.atomic_theory = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.blue.cards.length >= 2 && p.board.blue.splay !== 'right' && await yesNo(p, '青を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'blue', 'right');
          }
        }
      },
      { demand: false, icon: 'lightbulb', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 7); } }
    ];

    effectDefs.encyclopedia = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.score.length) return;
        var hiAge = ageOf(g, extremeByAge(g, p.score, 'max')[0]);
        var ids = p.score.filter(function (id) { return ageOf(g, id) === hiAge; });
        if (await yesNo(p, '得点パイルの最高値カードをすべてメルドしますか？')) {
          ids.slice().forEach(function (id) { engine.meldCard(g, p, id); });
        }
      }
    }];

    effectDefs.industrialization = [
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var colors = COLORS.filter(function (c) {
            return p.board[c].cards.some(function (id) { return hasIcon(g, id, 'factory'); });
          });
          for (var i = 0; i < colors.length; i++) await drawAndTuck(g, p, 6);
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['right']).filter(function (o) { return o.color === 'red' || o.color === 'purple'; });
          var choice = await pickSplay(p, opts, '赤か紫を右にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'right');
        }
      }
    ];

    effectDefs.machine_tools = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.score.length) return;
        var hiAge = ageOf(g, extremeByAge(g, p.score, 'max')[0]);
        await drawAndScore(g, p, hiAge);
      }
    }];

    effectDefs.classification = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを公開してください。');
        if (!id) return;
        var color = colorOf(g, id);
        g.players.forEach(function (o) {
          if (o.id === p.id) return;
          var top = engine.topCard(o, color);
          if (top) engine.transferCard(g, top, { player: o, zone: 'board', color: color }, { player: p, zone: 'hand' });
        });
      }
    }];

    effectDefs.metric_system = [
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.green.splay !== 'right') return;
          var opts = splayableColors(p, ['right']);
          var choice = await pickSplay(p, opts, '右にスプレイする色を選んでください。', true);
          if (choice) engine.setSplay(g, p, choice.color, 'right');
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.green.cards.length >= 2 && p.board.green.splay !== 'right' && await yesNo(p, '緑を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'green', 'right');
          }
        }
      }
    ];

    effectDefs.canning = [
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (await yesNo(p, '6を引いてタックしますか？')) {
            await drawAndTuck(g, p, 6);
            var tops = topCardsOf(g, p).filter(function (id) { return !hasIcon(g, id, 'factory'); });
            tops.forEach(function (id) { engine.scoreCard(g, p, id); });
          }
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.yellow.cards.length >= 2 && p.board.yellow.splay !== 'right' && await yesNo(p, '黄を右にスプレイしますか？')) {
            engine.setSplay(g, p, 'yellow', 'right');
          }
        }
      }
    ];

    effectDefs.vaccination = [
      {
        demand: true, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          if (!target.score.length) return;
          var loAge = ageOf(g, extremeByAge(g, target.score, 'min')[0]);
          var ids = target.score.filter(function (id) { return ageOf(g, id) === loAge; }).slice();
          ids.forEach(function (id) { engine.returnCardFromPlayer(g, target, id); });
          if (ids.length) { await drawAndMeld(g, target, 6); ctx._vaccination_returned = true; }
        }
      },
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          if (ctx._vaccination_returned) await drawAndMeld(ctx.game, ctx.actor, 7);
        }
      }
    ];

    effectDefs.democracy = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から好きな数のカードを戻してください。', 0, p.hand.length);
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        ctx._democracy_returned = ctx._democracy_returned || {};
        ctx._democracy_returned[p.id] = (ctx._democracy_returned[p.id] || 0) + chosen.length;
        var myCount = ctx._democracy_returned[p.id] || 0;
        var mostAmongOthers = g.players.every(function (o) {
          return o.id === p.id || (ctx._democracy_returned[o.id] || 0) < myCount;
        });
        if (myCount > 0 && mostAmongOthers) await drawAndScore(g, p, 8);
      }
    }];

    effectDefs.emancipation = [
      {
        demand: true, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var id = await pickOne(target, target.hand.slice(), actor.name + ' の得点パイルに手札のカードを渡してください。');
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'score' });
            engine.drawCard(g, target, 6);
          }
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['right']).filter(function (o) { return o.color === 'red' || o.color === 'purple'; });
          var choice = await pickSplay(p, opts, '赤か紫を右にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'right');
        }
      }
    ];

    // ======================================================================
    // AGE 7
    // ======================================================================

    effectDefs.evolution = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (await yesNo(p, '8を引いて得点し、得点パイルからカードを戻しますか？（いいえの場合は得点パイルの最高値より高いカードを引く）')) {
          await drawAndScore(g, p, 8);
          var rid = await pickOne(p, p.score.slice(), '得点パイルからカードを1枚戻してください。', true);
          if (rid) engine.returnCardFromPlayer(g, p, rid);
        } else {
          if (p.score.length) {
            var hiAge = ageOf(g, extremeByAge(g, p.score, 'max')[0]);
            engine.drawCard(g, p, hiAge + 1);
          }
        }
      }
    }];

    effectDefs.publication = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var colors = COLORS.filter(function (c) { return p.board[c].cards.length >= 2; });
          var color = await pickColor(p, colors, '並べ替える色を選んでください。', true);
          if (!color) return;
          // Let the player pick the new order from top to bottom
          var remaining = p.board[color].cards.slice();
          var total = remaining.length;
          var newOrder = [];
          for (var i = 0; i < total; i++) {
            var pos = i === 0 ? '一番上' : i === total - 1 ? '一番下' : (i + 1) + '番目';
            var picked = await pickOne(p, remaining,
              COLOR_JA[color] + ' のカード (' + pos + ') を選んでください。');
            if (!picked) picked = remaining[0]; // fallback
            newOrder.push(picked);
            remaining = remaining.filter(function (id) { return id !== picked; });
          }
          // newOrder[0]=top → board.cards stores bottom at [0], top at [last]
          p.board[color].cards = newOrder.slice().reverse();
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['up']).filter(function (o) { return o.color === 'yellow' || o.color === 'blue'; });
          var choice = await pickSplay(p, opts, '黄か青を上にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'up');
        }
      }
    ];

    effectDefs.combustion = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var times = Math.floor(engine.iconCount(g, actor, 'crown') / 4);
          for (var i = 0; i < times; i++) {
            var id = await pickOne(target, target.score.slice(), actor.name + ' に得点パイルからカードを渡してください。', true);
            if (!id) break;
            engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var redCards = p.board.red.cards;
          if (redCards.length) engine.returnCardFromPlayer(g, p, redCards[redCards.length - 1]);
        }
      }
    ];

    effectDefs.explosives = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        if (!target.hand.length) return;
        var hi = extremeByAge(g, target.hand, 'max');
        var chosen = await pickSome(target, hi, actor.name + ' の手札に最高値カードを3枚渡してください。', Math.min(3, hi.length), Math.min(3, hi.length));
        chosen.forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
        });
        if (chosen.length && !target.hand.length) engine.drawCard(g, target, 7);
      }
    }];

    effectDefs.bicycle = [{
      demand: false, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (await yesNo(p, '手札と得点パイルをすべて交換しますか？')) {
          var tmp = p.hand; p.hand = p.score; p.score = tmp;
          engine.log(g, p.name + ' は手札と得点パイルをすべて交換した');
        }
      }
    }];

    effectDefs.electricity = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var tops = topCardsOf(g, p).filter(function (id) { return !hasIcon(g, id, 'factory'); }).slice();
        tops.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        for (var i = 0; i < tops.length; i++) engine.drawCard(g, p, 8);
      }
    }];

    effectDefs.refrigeration = [
      {
        demand: true, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var n = Math.floor(target.hand.length / 2);
          for (var i = 0; i < n; i++) {
            var lo = extremeByAge(g, target.hand, 'min');
            var id = await pickOne(target, lo, '手札の最低値カードを戻してください。');
            if (id) engine.returnCardFromPlayer(g, target, id);
          }
        }
      },
      {
        demand: false, icon: 'leaf',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), '手札からカードを得点しますか？', true);
          if (id) engine.scoreCard(g, p, id);
        }
      }
    ];

    effectDefs.sanitation = [{
      demand: true, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        if (target.hand.length < 2 || !actor.hand.length) return;
        var hi2 = extremeByAge(g, target.hand, 'max').slice(0, 2);
        if (target.hand.length > 2) {
          hi2 = await pickSome(target, extremeByAge(g, target.hand, 'max'), actor.name + ' の手札に最高値カードを2枚渡してください。', 2, 2);
        }
        var lo1 = extremeByAge(g, actor.hand, 'min')[0];
        if (!lo1) return;
        hi2.forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
        });
        engine.transferCard(g, lo1, { player: actor, zone: 'hand' }, { player: target, zone: 'hand' });
      }
    }];

    effectDefs.lighting = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から最大3枚のカードをタックしてください。', 0, Math.min(3, p.hand.length));
        chosen.forEach(function (id) { engine.tuckCard(g, p, id); });
        if (chosen.length) {
          var n = distinctValues(g, chosen);
          for (var i = 0; i < n; i++) await drawAndScore(g, p, 7);
        }
      }
    }];

    effectDefs.railroad = [
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          engine.drawCard(g, p, 6); engine.drawCard(g, p, 6); engine.drawCard(g, p, 6);
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['up']).filter(function (o) { return p.board[o.color].splay === 'right'; });
          var choice = await pickSplay(p, opts, '右スプレイの色を上にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'up');
        }
      }
    ];

    // ======================================================================
    // AGE 8
    // ======================================================================

    effectDefs.quantum_theory = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から最大2枚のカードを戻してください。', 0, Math.min(2, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (chosen.length === 2) { engine.drawCard(g, p, 10); await drawAndScore(g, p, 10); }
      }
    }];

    effectDefs.rocketry = [{
      demand: false, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var times = Math.floor(engine.iconCount(g, p, 'clock') / 2);
        for (var i = 0; i < times; i++) {
          var others = g.players.filter(function (o) { return o.id !== p.id && o.score.length; });
          if (!others.length) break;
          var otherId = await p.controller.choosePlayer(p, { ids: others.map(function (o) { return o.id; }), prompt: '得点パイルからカードを戻す相手を選んでください。' });
          var other = g.players.find ? g.players.find(function (o) { return o.id === otherId; }) : g.players[otherId];
          if (!other || !other.score.length) continue;
          var id = await pickOne(p, other.score.slice(), other.name + ' の得点パイルから戻すカードを選んでください。');
          if (id) engine.returnCardFromPlayer(g, other, id);
        }
      }
    }];

    effectDefs.flight = [
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.red.splay !== 'up') return;
          var opts = splayableColors(p, ['up']);
          var choice = await pickSplay(p, opts, '上にスプレイする色を選んでください。', true);
          if (choice) engine.setSplay(g, p, choice.color, 'up');
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.red.cards.length >= 2 && p.board.red.splay !== 'up' && await yesNo(p, '赤を上にスプレイしますか？')) {
            engine.setSplay(g, p, 'red', 'up');
          }
        }
      }
    ];

    effectDefs.mobility = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var eligible = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'red' && !hasIcon(g, id, 'factory'); });
        var hi = extremeByAge(g, eligible, 'max');
        var chosen = await pickSome(target, hi, actor.name + ' の得点パイルに工場なし（赤以外）の最高値一番上のカードを2枚渡してください。', Math.min(2, hi.length), Math.min(2, hi.length));
        chosen.forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
        });
        if (chosen.length) engine.drawCard(g, target, 8);
      }
    }];

    effectDefs.corporations = [
      {
        demand: true, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'green' && hasIcon(g, id, 'factory'); });
          var id = await pickOne(target, ids, actor.name + ' の得点パイルに工場アイコン付き（緑以外）の一番上のカードを渡してください。');
          if (id) {
            engine.transferCard(g, id, { player: target, zone: 'board', color: colorOf(g, id) }, { player: actor, zone: 'score' });
            await drawAndMeld(g, target, 8);
          }
        }
      },
      { demand: false, icon: 'factory', run: async function (ctx) { await drawAndMeld(ctx.game, ctx.actor, 8); } }
    ];

    effectDefs.mass_media = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
          if (!id) return;
          engine.returnCardFromPlayer(g, p, id);
          var values = [];
          for (var a = 1; a <= 10; a++) values.push(a);
          var val = await p.controller.chooseValue ? await p.controller.chooseValue(p, { values: values, prompt: '価値を選んでください。' }) : ageOf(g, id);
          g.players.forEach(function (o) {
            o.score.filter(function (sid) { return ageOf(g, sid) === val; }).slice().forEach(function (sid) {
              engine.returnCardFromPlayer(g, o, sid);
            });
          });
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.purple.cards.length >= 2 && p.board.purple.splay !== 'up' && await yesNo(p, '紫を上にスプレイしますか？')) {
            engine.setSplay(g, p, 'purple', 'up');
          }
        }
      }
    ];

    effectDefs.antibiotics = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から最大3枚のカードを戻してください。', 0, Math.min(3, p.hand.length));
        chosen.forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
        if (!chosen.length) return;
        var n = distinctValues(g, chosen);
        for (var i = 0; i < n; i++) { engine.drawCard(g, p, 8); engine.drawCard(g, p, 8); }
      }
    }];

    effectDefs.skyscrapers = [{
      demand: true, icon: 'crown',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var ids = topCardsOf(g, target).filter(function (id) { return colorOf(g, id) !== 'yellow' && hasIcon(g, id, 'clock'); });
        var id = await pickOne(target, ids, actor.name + ' のボードに時計アイコン付き（黄以外）の一番上のカードを渡してください。');
        if (id) {
          var color = colorOf(g, id);
          engine.transferCard(g, id, { player: target, zone: 'board', color: color }, { player: actor, zone: 'board', color: color });
          var pile = target.board[color].cards;
          if (pile.length) {
            var beneath = pile[pile.length - 1];
            engine.scoreCard(g, target, beneath);
            pile.slice().forEach(function (rid) { engine.returnCardFromPlayer(g, target, rid); });
          }
        }
      }
    }];

    effectDefs.empiricism = [
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var c1 = await pickColor(p, COLORS, '1色目を選んでください。');
          var c2 = await pickColor(p, COLORS.filter(function (c) { return c !== c1; }), '2色目を選んでください。');
          var id = engine.drawCard(g, p, 9);
          if (!id) return;
          var drawn = colorOf(g, id);
          if (drawn === c1 || drawn === c2) {
            engine.meldCard(g, p, id);
            if (p.board[drawn].cards.length >= 2 && p.board[drawn].splay !== 'up' && await yesNo(p, drawn + ' を上にスプレイしますか？')) {
              engine.setSplay(g, p, drawn, 'up');
            }
          }
        }
      },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (g.winner != null) return;
          if (engine.iconCount(g, p, 'lightbulb') >= 20) {
            g.winner = p.id; g.endReason = 'dogma_win';
            engine.log(g, p.name + ' は電球20個以上で勝利！');
          }
        }
      }
    ];

    effectDefs.socialism = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.hand.length) return;
        if (!await yesNo(p, '手札のカードをすべてタックしますか？')) return;
        var tucked = p.hand.slice();
        tucked.forEach(function (id) { engine.tuckCard(g, p, id); });
        var anyPurple = tucked.some(function (id) { return colorOf(g, id) === 'purple'; });
        if (anyPurple) {
          g.players.forEach(function (o) {
            if (o.id === p.id || !o.hand.length) return;
            var loAge = ageOf(g, extremeByAge(g, o.hand, 'min')[0]);
            o.hand.filter(function (id) { return ageOf(g, id) === loAge; }).slice().forEach(function (id) {
              engine.transferCard(g, id, { player: o, zone: 'hand' }, { player: p, zone: 'hand' });
            });
          });
        }
      }
    }];

    // ======================================================================
    // AGE 9
    // ======================================================================

    effectDefs.computers = [
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          ['red', 'green'].forEach(function (c) {
            if (p.board[c].cards.length >= 2 && p.board[c].splay !== 'up') engine.setSplay(g, p, c, 'up');
          });
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await drawAndMeld(g, p, 10);
          if (id && engine.executeEffects) await engine.executeEffects(g, p, id, false);
        }
      }
    ];

    effectDefs.genetics = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await drawAndMeld(g, p, 10);
        if (!id) return;
        var color = colorOf(g, id);
        var pile = p.board[color].cards;
        pile.slice(1).forEach(function (sid) { engine.scoreCard(g, p, sid); });
      }
    }];

    effectDefs.composites = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        if (target.hand.length > 1) {
          var keep = await pickOne(target, target.hand.slice(), '手札に残す1枚を選んでください。');
          target.hand.filter(function (id) { return id !== keep; }).slice().forEach(function (id) {
            engine.transferCard(g, id, { player: target, zone: 'hand' }, { player: actor, zone: 'hand' });
          });
        }
        if (target.score.length) {
          var hi = extremeByAge(g, target.score, 'max')[0];
          if (hi) engine.transferCard(g, hi, { player: target, zone: 'score' }, { player: actor, zone: 'score' });
        }
      }
    }];

    effectDefs.fission = [
      {
        demand: true, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var id = engine.drawCard(g, target, 10);
          if (id && colorOf(g, id) === 'red') {
            g.players.forEach(function (pl) {
              pl.hand.slice().forEach(function (cid) { engine.removeCardFromPlayer(g, pl, 'hand', cid); });
              pl.score.slice().forEach(function (cid) { engine.removeCardFromPlayer(g, pl, 'score', cid); });
              COLORS.forEach(function (c) { pl.board[c].cards.slice().forEach(function (cid) { engine.removeCardFromPlayer(g, pl, 'board', cid); }); });
            });
            ctx._fission_wiped = true;
          }
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          if (ctx._fission_wiped) return;
          var g = ctx.game, p = ctx.actor;
          var allTops = [];
          g.players.forEach(function (o) {
            topCardsOf(g, o).forEach(function (id) { if (engine.card(g, id).id !== 'fission') allTops.push({ player: o, id: id }); });
          });
          if (!allTops.length) { engine.drawCard(g, p, 10); return; }
          var idx = await pickOne(p, allTops.map(function (x) { return x.id; }), '任意のプレイヤーのボードの一番上のカード（核分裂以外）を戻してください。');
          if (idx) {
            var entry = allTops.find ? allTops.find(function (x) { return x.id === idx; }) : allTops.filter(function (x) { return x.id === idx; })[0];
            if (entry) engine.returnCardFromPlayer(g, entry.player, idx);
          }
          engine.drawCard(g, p, 10);
        }
      }
    ];

    effectDefs.collaboration = [
      {
        demand: true, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var d1 = engine.drawCard(g, target, 9);
          var d2 = engine.drawCard(g, target, 9);
          var both = [d1, d2].filter(Boolean);
          if (!both.length) return;
          var chosen = await pickOne(actor, both, '自分のボードに移すカードを選んでください。');
          if (chosen) {
            engine.transferCard(g, chosen, { player: target, zone: 'hand' }, { player: actor, zone: 'board', color: colorOf(g, chosen) });
            var other = both.filter(function (id) { return id !== chosen; })[0];
            if (other) engine.meldCard(g, target, other);
          }
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (g.winner != null) return;
          var greenCount = p.board.green.cards.length;
          if (greenCount >= 10) { g.winner = p.id; g.endReason = 'dogma_win'; engine.log(g, p.name + ' は緑10枚以上で勝利！'); }
        }
      }
    ];

    effectDefs.satellites = [
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          p.hand.slice().forEach(function (id) { engine.returnCardFromPlayer(g, p, id); });
          engine.drawCard(g, p, 8); engine.drawCard(g, p, 8); engine.drawCard(g, p, 8);
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.purple.cards.length >= 2 && p.board.purple.splay !== 'up' && await yesNo(p, '紫を上にスプレイしますか？')) {
            engine.setSplay(g, p, 'purple', 'up');
          }
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), '手札からカードをメルドしてください。', true);
          if (id) {
            engine.meldCard(g, p, id);
            if (engine.executeEffects) await engine.executeEffects(g, p, id, false);
          }
        }
      }
    ];

    effectDefs.ecology = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) {
          engine.returnCardFromPlayer(g, p, id);
          var sid = await pickOne(p, p.hand.slice(), '手札からカードを得点してください。', true);
          if (sid) engine.scoreCard(g, p, sid);
          engine.drawCard(g, p, 10); engine.drawCard(g, p, 10);
        }
      }
    }];

    effectDefs.suburbia = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var chosen = await pickSome(p, p.hand.slice(), '手札から好きな数のカードをタックしてください。', 0, p.hand.length);
        chosen.forEach(function (id) { engine.tuckCard(g, p, id); });
        for (var i = 0; i < chosen.length; i++) await drawAndScore(g, p, 1);
      }
    }];

    effectDefs.services = [{
      demand: true, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        if (!target.score.length) return;
        var hiAge = ageOf(g, extremeByAge(g, target.score, 'max')[0]);
        var ids = target.score.filter(function (id) { return ageOf(g, id) === hiAge; }).slice();
        ids.forEach(function (id) {
          engine.transferCard(g, id, { player: target, zone: 'score' }, { player: actor, zone: 'hand' });
        });
        if (ids.length) {
          var noLeaf = topCardsOf(g, actor).filter(function (id) { return !hasIcon(g, id, 'leaf'); });
          var giveBack = await pickOne(actor, noLeaf, target.name + ' の手札に自分のボードの葉なし一番上のカードを渡してください。', true);
          if (giveBack) engine.transferCard(g, giveBack, { player: actor, zone: 'board', color: colorOf(g, giveBack) }, { player: target, zone: 'hand' });
        }
      }
    }];

    effectDefs.specialization = [
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id = await pickOne(p, p.hand.slice(), '手札からカードを公開してください。', true);
          if (!id) return;
          var color = colorOf(g, id);
          g.players.forEach(function (o) {
            if (o.id === p.id) return;
            var top = engine.topCard(o, color);
            if (top) engine.transferCard(g, top, { player: o, zone: 'board', color: color }, { player: p, zone: 'hand' });
          });
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var opts = splayableColors(p, ['up']).filter(function (o) { return o.color === 'yellow' || o.color === 'blue'; });
          var choice = await pickSplay(p, opts, '黄か青を上にスプレイしますか？', true);
          if (choice) engine.setSplay(g, p, choice.color, 'up');
        }
      }
    ];

    // ======================================================================
    // AGE 10
    // ======================================================================

    effectDefs.bioengineering = [
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var others = g.players.filter(function (o) { return o.id !== p.id; });
          var candidates = [];
          others.forEach(function (o) { topCardsWithIcon(g, o, 'leaf').forEach(function (id) { candidates.push({ player: o, id: id }); }); });
          if (!candidates.length) return;
          var chosen = await pickOne(p, candidates.map(function (x) { return x.id; }), '対戦相手のボードの葉アイコン付き一番上のカードを得点パイルに移してください。');
          if (chosen) {
            var entry = candidates.find ? candidates.find(function (x) { return x.id === chosen; }) : candidates.filter(function (x) { return x.id === chosen; })[0];
            if (entry) engine.transferCard(g, chosen, { player: entry.player, zone: 'board', color: colorOf(g, chosen) }, { player: p, zone: 'score' });
          }
        }
      },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (g.winner != null) return;
          var anyFew = g.players.some(function (o) { return engine.iconCount(g, o, 'leaf') < 3; });
          if (!anyFew) return;
          var myLeaf = engine.iconCount(g, p, 'leaf');
          var allOthersLess = g.players.every(function (o) { return o.id === p.id || engine.iconCount(g, o, 'leaf') < myLeaf; });
          if (allOthersLess && myLeaf > 0) { g.winner = p.id; g.endReason = 'dogma_win'; engine.log(g, p.name + ' は葉アイコン最多で勝利！'); }
        }
      }
    ];

    effectDefs.software = [
      { demand: false, icon: 'clock', run: async function (ctx) { await drawAndScore(ctx.game, ctx.actor, 10); } },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var id1 = await drawAndMeld(g, p, 10);
          var id2 = await drawAndMeld(g, p, 10);
          if (id2 && engine.executeEffects) await engine.executeEffects(g, p, id2, false);
        }
      }
    ];

    effectDefs.miniaturization = [{
      demand: false, icon: 'lightbulb',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var id = await pickOne(p, p.hand.slice(), '手札からカードを1枚戻しますか？', true);
        if (id) {
          var a = ageOf(g, id);
          engine.returnCardFromPlayer(g, p, id);
          if (a === 10) {
            var n = distinctValues(g, p.score);
            for (var i = 0; i < n; i++) engine.drawCard(g, p, 10);
          }
        }
      }
    }];

    effectDefs.robotics = [{
      demand: false, icon: 'factory',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        var greenTop = engine.topCard(p, 'green');
        if (greenTop) engine.scoreCard(g, p, greenTop);
        var id = await drawAndMeld(g, p, 10);
        if (id && engine.executeEffects) await engine.executeEffects(g, p, id, false);
      }
    }];

    effectDefs.databases = [{
      demand: true, icon: 'clock',
      run: async function (ctx) {
        var g = ctx.game, actor = ctx.actor, target = ctx.target;
        var n = Math.ceil(target.score.length / 2);
        for (var i = 0; i < n; i++) {
          var id = await pickOne(target, target.score.slice(), '得点パイルからカードを戻してください。');
          if (id) engine.returnCardFromPlayer(g, target, id);
        }
      }
    }];

    effectDefs.self_service = [
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var tops = topCardsOf(g, p).filter(function (id) { return engine.card(g, id).id !== 'self_service'; });
          var id = await pickOne(p, tops, '非強制効果を実行する一番上のカードを選んでください。', true);
          if (id && engine.executeEffects) await engine.executeEffects(g, p, id, false);
        }
      },
      {
        demand: false, icon: 'crown',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (g.winner != null) return;
          var myAch = p.achievements.length;
          var allOthersLess = g.players.every(function (o) { return o.id === p.id || o.achievements.length < myAch; });
          if (allOthersLess && myAch > 0) { g.winner = p.id; g.endReason = 'dogma_win'; engine.log(g, p.name + ' は達成数最多で勝利！'); }
        }
      }
    ];

    effectDefs.globalization = [
      {
        demand: true, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, actor = ctx.actor, target = ctx.target;
          var ids = topCardsWithIcon(g, target, 'leaf');
          var id = await pickOne(target, ids, '葉アイコン付きの一番上のカードを戻してください。');
          if (id) engine.returnCardFromPlayer(g, target, id);
        }
      },
      {
        demand: false, icon: 'factory',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          await drawAndScore(g, p, 6);
          if (g.winner != null) return;
          var noneMoreLeaf = g.players.every(function (o) {
            return engine.iconCount(g, o, 'leaf') <= engine.iconCount(g, o, 'factory');
          });
          if (!noneMoreLeaf) return;
          var myScore = engine.scoreValue(g, p);
          var allOthersLess = g.players.every(function (o) { return o.id === p.id || engine.scoreValue(g, o) < myScore; });
          if (allOthersLess && myScore > 0) { g.winner = p.id; g.endReason = 'dogma_win'; engine.log(g, p.name + ' は得点最多で勝利！'); }
        }
      }
    ];

    effectDefs.stem_cells = [{
      demand: false, icon: 'leaf',
      run: async function (ctx) {
        var g = ctx.game, p = ctx.actor;
        if (!p.hand.length) return;
        if (await yesNo(p, '手札のカードをすべて得点しますか？')) {
          p.hand.slice().forEach(function (id) { engine.scoreCard(g, p, id); });
        }
      }
    }];

    effectDefs.ai = [
      { demand: false, icon: 'lightbulb', run: async function (ctx) { await drawAndScore(ctx.game, ctx.actor, 10); } },
      {
        demand: false, icon: 'lightbulb',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (g.winner != null) return;
          var roboticsAndSoftware = g.players.some(function (o) {
            var tops = topCardsOf(g, o).map(function (id) { return engine.card(g, id).id; });
            return tops.indexOf('robotics') !== -1 && tops.indexOf('software') !== -1;
          });
          if (!roboticsAndSoftware) return;
          var myScore = engine.scoreValue(g, p);
          var allOthersMore = g.players.every(function (o) { return o.id === p.id || engine.scoreValue(g, o) > myScore; });
          if (allOthersMore) { g.winner = p.id; g.endReason = 'dogma_win'; engine.log(g, p.name + ' は最低得点で勝利！'); }
        }
      }
    ];

    effectDefs.the_internet = [
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          if (p.board.green.cards.length >= 2 && p.board.green.splay !== 'up' && await yesNo(p, '緑を上にスプレイしますか？')) {
            engine.setSplay(g, p, 'green', 'up');
          }
        }
      },
      { demand: false, icon: 'clock', run: async function (ctx) { await drawAndScore(ctx.game, ctx.actor, 10); } },
      {
        demand: false, icon: 'clock',
        run: async function (ctx) {
          var g = ctx.game, p = ctx.actor;
          var times = Math.floor(engine.iconCount(g, p, 'clock') / 2);
          for (var i = 0; i < times; i++) await drawAndMeld(g, p, 10);
        }
      }
    ];

    return effectDefs;
  };
});
