// Innovation base game (3rd Edition) - card database.
// id: stable slug. age: 1-10. color: yellow/red/green/blue/purple.
// icons: [ic0, ic1, ic2, ic3] where:
//   ic[0] = bottom-left  (spot_2; left splay hides it, right+up splays reveal it)
//   ic[1] = bottom-center(spot_3; only up splay reveals it)
//   ic[2] = bottom-right (spot_4; left+up splays reveal it)
//   ic[3] = top-left     (spot_1; right splay reveals it; shown in chip header)
// null = empty slot.
// dogma: [{ demand: bool, icon: iconName, text, textJa }]
//
// Data sourced from BGA Innovation SQL (micahstairs/bga-innovation), 3rd edition.
// Splay reveals: left→ic[2], right→ic[3]+ic[0], up→ic[0]+ic[1]+ic[2].
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var L = 'leaf', C = 'crown', B = 'lightbulb', F = 'factory', T = 'castle', K = 'clock';

  var CARDS = [
    // ---------------- AGE 1 (15 cards) ----------------
    { id: 'pottery', name: '陶器', age: 1, color: 'green', icons: [L, L, L, null],
      dogma: [{ demand: false, icon: L,
        text: 'You may return up to three cards from your hand. If you returned any cards, draw and score a card of value equal to the number of cards you returned.',
        textJa: '手札から最大3枚のカードを戻してもよい。1枚以上戻した場合、戻した枚数と同じ価値のカードを引いて得点する。' }] },

    { id: 'tools', name: '道具', age: 1, color: 'green', icons: [B, B, T, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may return three cards from your hand. If you do, draw and meld a 3.',
          textJa: '手札から3枚のカードを戻してもよい。した場合、3を引いてメルドする。' },
        { demand: false, icon: B,
          text: 'You may return a 3 from your hand. If you do, draw three 1s.',
          textJa: '手札から3を戻してもよい。した場合、1を3枚引く。' }
      ] },

    { id: 'writing', name: '文字', age: 1, color: 'green', icons: [B, B, C, null],
      dogma: [{ demand: false, icon: B,
        text: 'Draw a 2.',
        textJa: '2を引く。' }] },

    { id: 'archery', name: '弓術', age: 1, color: 'red', icons: [B, null, T, T],
      dogma: [{ demand: true, icon: T,
        text: 'I DEMAND you give me the highest card in your hand! If you do, draw a 1.',
        textJa: '【強制】対象プレイヤーは手札の最高値カードをあなたに渡す。渡した場合、対象プレイヤーは1を引く。' }] },

    { id: 'metalworking', name: '金属加工', age: 1, color: 'red', icons: [T, null, T, T],
      dogma: [{ demand: false, icon: T,
        text: 'Draw and reveal a 1. If it has a castle icon, score it and repeat this effect. Otherwise, keep it.',
        textJa: '1を引いて公開する。城アイコンを持っていれば、それを得点してこの効果を繰り返す。持っていなければ、手札に加える。' }] },

    { id: 'oars', name: '櫂', age: 1, color: 'red', icons: [C, null, T, T],
      dogma: [{ demand: true, icon: T,
        text: 'I DEMAND you transfer a card with a crown icon from your hand to my score pile! If you do, draw a 1, and repeat this demand! If no cards were transferred, I draw a 1.',
        textJa: '【強制】対象プレイヤーは王冠アイコン付きカードを手札からあなたの得点パイルに渡す。渡した場合、対象プレイヤーは1を引き、この要求を繰り返す。渡せなかった場合、あなたが1を引く。' }] },

    { id: 'clothing', name: '衣服', age: 1, color: 'blue', icons: [C, L, L, null],
      dogma: [
        { demand: false, icon: L,
          text: 'Meld a card from your hand of different color from any card on your board.',
          textJa: '自分のボード上のどのカードとも異なる色のカードを手札からメルドする。' },
        { demand: false, icon: L,
          text: 'Draw and score a 1 for each color present on your board not present on any opponent\'s board.',
          textJa: '自分のボードにある色のうち、どの対戦相手のボードにもない色の数だけ、1を引いて得点する。' }
      ] },

    { id: 'sailing', name: '帆走', age: 1, color: 'blue', icons: [C, null, L, C],
      dogma: [{ demand: false, icon: C,
        text: 'Draw and meld a 1.',
        textJa: '1を引いてメルドする。' }] },

    { id: 'the_wheel', name: '車輪', age: 1, color: 'blue', icons: [T, T, T, null],
      dogma: [{ demand: false, icon: T,
        text: 'Draw two 1s.',
        textJa: '1を2枚引く。' }] },

    { id: 'agriculture', name: '農業', age: 1, color: 'yellow', icons: [L, L, L, null],
      dogma: [{ demand: false, icon: L,
        text: 'You may return a card from your hand. If you do, draw and score a card of value one higher than the card you returned.',
        textJa: '手札からカードを1枚戻してもよい。した場合、戻したカードより価値が1高いカードを引いて得点する。' }] },

    { id: 'domestication', name: '家畜化', age: 1, color: 'yellow', icons: [C, null, T, T],
      dogma: [{ demand: false, icon: T,
        text: 'Meld the lowest card in your hand. Draw a 1.',
        textJa: '手札の最低値カードをメルドする。1を引く。' }] },

    { id: 'masonry', name: '石工術', age: 1, color: 'yellow', icons: [null, T, T, T],
      dogma: [{ demand: false, icon: T,
        text: 'You may meld any number of cards from your hand, each with a castle icon. If you meld 4 or more, claim the Monument special achievement.',
        textJa: '手札から城アイコン付きカードを好きな数メルドしてもよい。4枚以上メルドした場合、記念碑特別達成カードを獲得する。' }] },

    { id: 'city_states', name: '都市国家', age: 1, color: 'purple', icons: [C, C, T, null],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer a top card with a castle icon from your board to my board if you have four or more castle icons! If you do, draw a 1!',
        textJa: '【強制】対象プレイヤーが城アイコンを4個以上持っている場合、ボードの一番上の城アイコン付きカードをあなたのボードに渡す。渡した場合、対象プレイヤーは1を引く。' }] },

    { id: 'code_of_laws', name: '法典', age: 1, color: 'purple', icons: [C, C, L, null],
      dogma: [{ demand: false, icon: C,
        text: 'You may tuck a card from your hand that shares a color with a top card on your board. If you do, you may splay that color left.',
        textJa: '自分のボードの一番上のカードと同じ色のカードを手札からタックしてもよい。した場合、その色を左にスプレイしてもよい。' }] },

    { id: 'mysticism', name: '神秘主義', age: 1, color: 'purple', icons: [T, T, T, null],
      dogma: [{ demand: false, icon: T,
        text: 'Draw and reveal a 1. If it is the same color as any card on your board, meld it and draw a 1.',
        textJa: '1を引いて公開する。ボード上のどれかのカードと同じ色であれば、それをメルドして1を引く。' }] },

    // ---------------- AGE 2 (10 cards) ----------------
    { id: 'calendar', name: '暦', age: 2, color: 'green', icons: [L, L, B, null],
      dogma: [{ demand: false, icon: L,
        text: 'If you have more cards in your score pile than in your hand, draw two 3s.',
        textJa: '得点パイルのカード枚数が手札より多ければ、3を2枚引く。' }] },

    { id: 'mathematics', name: '数学', age: 2, color: 'green', icons: [B, C, B, null],
      dogma: [{ demand: false, icon: B,
        text: 'You may return a card from your hand. If you do, draw and meld a card of value one higher than the card you returned.',
        textJa: '手札からカードを1枚戻してもよい。した場合、戻したカードより価値が1高いカードを引いてメルドする。' }] },

    { id: 'construction', name: '建築', age: 2, color: 'red', icons: [null, T, T, T],
      dogma: [
        { demand: true, icon: T,
          text: 'I DEMAND you transfer two cards from your hand to my hand! Draw a 2!',
          textJa: '【強制】対象プレイヤーは手札から2枚のカードをあなたの手札に渡す。対象プレイヤーは2を引く。' },
        { demand: false, icon: T,
          text: 'If you are the only player with five top cards, claim the Empire achievement.',
          textJa: 'あなただけが5枚の一番上のカードを持っていれば、帝国達成カードを獲得する。' }
      ] },

    { id: 'road_building', name: '道路建設', age: 2, color: 'red', icons: [T, null, T, T],
      dogma: [{ demand: false, icon: T,
        text: 'Meld one or two cards from your hand. If you melded two, you may transfer your top red card to an opponent\'s board, and if you do, take their top green card.',
        textJa: '手札から1〜2枚のカードをメルドする。2枚メルドした場合、赤の一番上のカードを対戦相手のボードに渡してもよい。渡した場合、その対戦相手の緑の一番上のカードを取る。' }] },

    { id: 'currency', name: '貨幣', age: 2, color: 'blue', icons: [C, null, C, L],
      dogma: [{ demand: false, icon: C,
        text: 'You may return any number of cards from your hand. If you returned any, draw and score a 2 for each different value among the returned cards.',
        textJa: '手札から好きな数のカードを戻してもよい。1枚以上戻した場合、戻したカードの異なる価値1種につき2を引いて得点する。' }] },

    { id: 'mapmaking', name: '地図作成', age: 2, color: 'blue', icons: [C, C, T, null],
      dogma: [
        { demand: true, icon: C,
          text: 'I DEMAND you transfer a card of value 1 from your score pile to my score pile!',
          textJa: '【強制】対象プレイヤーは得点パイルから価値1のカードをあなたの得点パイルに渡す。' },
        { demand: false, icon: C,
          text: 'If any card was transferred as a result of the demand, draw and score a 1.',
          textJa: 'この要求でカードが渡されていた場合、1を引いて得点する。' }
      ] },

    { id: 'canal_building', name: '運河建設', age: 2, color: 'yellow', icons: [C, L, C, null],
      dogma: [{ demand: false, icon: C,
        text: 'You may exchange all the cards in your hand with all the cards in your score pile.',
        textJa: '手札のカードすべてを得点パイルのカードすべてと交換してもよい。' }] },

    { id: 'fermenting', name: '発酵', age: 2, color: 'yellow', icons: [L, null, T, L],
      dogma: [{ demand: false, icon: L,
        text: 'Draw a 2 for every two leaf icons on your board.',
        textJa: 'ボード上の葉アイコン2個につき2を引く。' }] },

    { id: 'monotheism', name: '一神教', age: 2, color: 'purple', icons: [T, T, T, null],
      dogma: [
        { demand: true, icon: T,
          text: 'I DEMAND you transfer a top card on your board of different color from any card on my board to my score pile! If you do, draw and tuck a 1!',
          textJa: '【強制】対象プレイヤーは、あなたのボードにあるカードとは異なる色のボードの一番上のカードをあなたの得点パイルに渡す。渡した場合、対象プレイヤーは1を引いてタックする。' },
        { demand: false, icon: T,
          text: 'Draw and tuck a 1.',
          textJa: '1を引いてタックする。' }
      ] },

    { id: 'philosophy', name: '哲学', age: 2, color: 'purple', icons: [B, B, B, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may splay left any one color of your cards.',
          textJa: '自分のカードのうち1色を左にスプレイしてもよい。' },
        { demand: false, icon: B,
          text: 'You may score a card from your hand.',
          textJa: '手札からカードを1枚得点してもよい。' }
      ] },

    // ---------------- AGE 3 (10 cards) ----------------
    { id: 'alchemy', name: '錬金術', age: 3, color: 'green', icons: [L, T, T, null],
      dogma: [
        { demand: false, icon: T,
          text: 'Draw and reveal a 4 for every three castle icons on your board. If any of the drawn cards are red, return the cards drawn and all cards in your hand. Otherwise, keep them.',
          textJa: 'ボード上の城アイコン3個につき4を引いて公開する。引いたカードに赤があれば、引いたカードと手札のカードをすべて戻す。なければそのまま持つ。' },
        { demand: false, icon: T,
          text: 'Meld a card from your hand, then score a card from your hand.',
          textJa: '手札からカードを1枚メルドし、その後手札からカードを1枚得点する。' }
      ] },

    { id: 'translation', name: '翻訳', age: 3, color: 'green', icons: [C, C, C, null],
      dogma: [
        { demand: false, icon: C,
          text: 'You may meld all the cards in your score pile. If you meld one, you must meld them all.',
          textJa: '得点パイルのカードをすべてメルドしてもよい。1枚メルドする場合はすべてメルドしなければならない。' },
        { demand: false, icon: C,
          text: 'If each top card on your board has a crown icon, claim the World achievement.',
          textJa: '自分のボードの一番上のカードすべてに王冠アイコンがあれば、世界達成カードを獲得する。' }
      ] },

    { id: 'engineering', name: '工学', age: 3, color: 'red', icons: [null, B, T, T],
      dogma: [
        { demand: true, icon: T,
          text: 'I DEMAND you transfer all top cards with a castle icon from your board to my score pile!',
          textJa: '【強制】対象プレイヤーは、ボードの一番上にある城アイコン付きカードをすべてあなたの得点パイルに渡す。' },
        { demand: false, icon: T,
          text: 'You may splay your red cards left.',
          textJa: '赤のカードを左にスプレイしてもよい。' }
      ] },

    { id: 'optics', name: '光学', age: 3, color: 'red', icons: [C, C, null, C],
      dogma: [{ demand: false, icon: C,
        text: 'Draw and meld a 3. If it has a crown icon, draw and score a 4. Otherwise, transfer a card from your score pile to the score pile of an opponent with fewer points than you.',
        textJa: '3を引いてメルドする。王冠アイコンを持っていれば4を引いて得点する。持っていなければ、自分より得点が少ない対戦相手の得点パイルに得点パイルからカードを1枚渡す。' }] },

    { id: 'compass', name: '羅針盤', age: 3, color: 'blue', icons: [C, C, L, null],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer a top non-green card with a leaf icon from your board to my board, and then you transfer a top card without a leaf icon from my board to your board!',
        textJa: '【強制】対象プレイヤーは、ボードの一番上の緑以外の葉アイコン付きカードをあなたのボードに渡す。さらにあなたのボードから葉アイコンのない一番上のカードを対象プレイヤーのボードに渡す。' }] },

    { id: 'paper', name: '紙', age: 3, color: 'blue', icons: [B, B, C, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may splay your green or blue cards left.',
          textJa: '緑または青のカードを左にスプレイしてもよい。' },
        { demand: false, icon: B,
          text: 'Draw a 4 for every color you have splayed left.',
          textJa: '左にスプレイしている色1つにつき4を引く。' }
      ] },

    { id: 'machinery', name: '機械', age: 3, color: 'yellow', icons: [L, null, T, L],
      dogma: [{ demand: true, icon: L,
        text: 'I DEMAND we trade our highest value top cards with a castle icon! If you have no such card, I draw and meld a 1.',
        textJa: '【強制】あなたと対象プレイヤーは、城アイコンを持つ一番上のカードのうち最高値のものを交換する。対象プレイヤーにそのようなカードがなければ、あなたが1を引いてメルドする。' }] },

    { id: 'medicine', name: '医学', age: 3, color: 'yellow', icons: [L, L, null, C],
      dogma: [{ demand: true, icon: L,
        text: 'I DEMAND you exchange the highest card in your score pile with the lowest card in my score pile!',
        textJa: '【強制】対象プレイヤーの得点パイルの最高値カードと、あなたの得点パイルの最低値カードを交換する。' }] },

    { id: 'education', name: '教育', age: 3, color: 'purple', icons: [B, B, null, B],
      dogma: [{ demand: false, icon: B,
        text: 'You may return the highest card from your score pile. If you do, draw a card of value two higher than your new highest card in your score pile.',
        textJa: '得点パイルの最高値カードを戻してもよい。した場合、新たな得点パイルの最高値カードより価値が2高いカードを引く。' }] },

    { id: 'feudalism', name: '封建制', age: 3, color: 'purple', icons: [T, L, T, null],
      dogma: [
        { demand: true, icon: T,
          text: 'I DEMAND you transfer a card with a castle icon from your hand to my hand!',
          textJa: '【強制】対象プレイヤーは城アイコン付きカードを手札からあなたの手札に渡す。' },
        { demand: false, icon: T,
          text: 'You may splay your yellow or purple cards left.',
          textJa: '黄または紫のカードを左にスプレイしてもよい。' }
      ] },

    // ---------------- AGE 4 (10 cards) ----------------
    { id: 'experimentation', name: '実験', age: 4, color: 'green', icons: [B, B, B, null],
      dogma: [{ demand: false, icon: B,
        text: 'Draw and meld a 5.',
        textJa: '5を引いてメルドする。' }] },

    { id: 'printing_press', name: '活版印刷', age: 4, color: 'green', icons: [B, B, C, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may return a card from your score pile. If you do, draw a card of value two higher than the top purple card on your board.',
          textJa: '得点パイルからカードを1枚戻してもよい。した場合、ボードの一番上の紫カードより価値が2高いカードを引く。' },
        { demand: false, icon: B,
          text: 'You may splay your blue cards right.',
          textJa: '青のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'colonialism', name: '植民地主義', age: 4, color: 'red', icons: [F, B, F, null],
      dogma: [{ demand: false, icon: F,
        text: 'Draw and tuck a 3. If the tucked card has a crown icon, repeat this effect.',
        textJa: '3を引いてタックする。タックしたカードに王冠アイコンがあれば、この効果を繰り返す。' }] },

    { id: 'gunpowder', name: '火薬', age: 4, color: 'red', icons: [F, C, F, null],
      dogma: [
        { demand: true, icon: F,
          text: 'I DEMAND you transfer the highest top card on your board with a castle icon to my score pile! If you do, you may return a card from your hand.',
          textJa: '【強制】対象プレイヤーは城アイコンを持つボードの一番上のカードのうち最高値のものをあなたの得点パイルに渡す。渡した場合、対象プレイヤーは手札からカードを1枚戻してもよい。' },
        { demand: false, icon: F,
          text: 'If any card was transferred as a result of the demand, draw and score a 2.',
          textJa: 'この要求でカードが渡されていた場合、2を引いて得点する。' }
      ] },

    { id: 'invention', name: '発明', age: 4, color: 'blue', icons: [B, B, F, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may splay right any one color of your cards currently splayed left. If you do, draw and score a 4.',
          textJa: '左にスプレイしている色のうち1つを右にスプレイしてもよい。した場合、4を引いて得点する。' },
        { demand: false, icon: B,
          text: 'If you have five colors splayed, each in any direction, claim the Wonder achievement.',
          textJa: '5色すべてを（方向は問わず）スプレイしていれば、驚異達成カードを獲得する。' }
      ] },

    { id: 'navigation', name: '航海術', age: 4, color: 'blue', icons: [C, C, C, null],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer a 2 or a 3 from your score pile to my score pile!',
        textJa: '【強制】対象プレイヤーは得点パイルから価値2または3のカードをあなたの得点パイルに渡す。' }] },

    { id: 'anatomy', name: '解剖学', age: 4, color: 'yellow', icons: [L, L, null, L],
      dogma: [{ demand: true, icon: L,
        text: 'I DEMAND you return a card from your score pile! If you do, return a top card of equal value from your board!',
        textJa: '【強制】対象プレイヤーは得点パイルからカードを1枚戻す。戻した場合、そのカードと同じ価値のボードの一番上のカードを戻す。' }] },

    { id: 'perspective', name: '遠近法', age: 4, color: 'yellow', icons: [B, B, L, null],
      dogma: [{ demand: false, icon: B,
        text: 'You may return a card from your hand. If you do, score a card from your hand for every two lightbulb icons on your board.',
        textJa: '手札からカードを1枚戻してもよい。した場合、ボード上の電球アイコン2個につき手札からカードを1枚得点する。' }] },

    { id: 'enterprise', name: '企業', age: 4, color: 'purple', icons: [C, C, C, null],
      dogma: [
        { demand: true, icon: C,
          text: 'I DEMAND you transfer a top non-purple card with a crown icon from your board to my board! If you do, draw and meld a 4!',
          textJa: '【強制】対象プレイヤーは王冠アイコン付きの紫以外の一番上のカードをあなたのボードに渡す。渡した場合、対象プレイヤーは4を引いてメルドする。' },
        { demand: false, icon: C,
          text: 'You may splay your green cards right.',
          textJa: '緑のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'reformation', name: '宗教改革', age: 4, color: 'purple', icons: [L, null, L, L],
      dogma: [
        { demand: false, icon: L,
          text: 'You may tuck a card from your hand for every two leaf icons on your board.',
          textJa: 'ボード上の葉アイコン2個につき手札からカードを1枚タックしてもよい。' },
        { demand: false, icon: L,
          text: 'You may tuck a card from your hand for every two leaf icons on your board.',
          textJa: 'ボード上の葉アイコン2個につき手札からカードを1枚タックしてもよい。' }
      ] },

    // ---------------- AGE 5 (10 cards) ----------------
    { id: 'chemistry', name: '化学', age: 5, color: 'green', icons: [B, F, null, F],
      dogma: [
        { demand: false, icon: F,
          text: 'You may splay your blue cards right.',
          textJa: '青のカードを右にスプレイしてもよい。' },
        { demand: false, icon: F,
          text: 'Draw and score a card of value one higher than the highest top card on your board and then return a card from your score pile.',
          textJa: '自分のボードの一番上のカードのうち最高値のものより価値が1高いカードを引いて得点し、その後得点パイルからカードを1枚戻す。' }
      ] },

    { id: 'physics', name: '物理学', age: 5, color: 'green', icons: [B, B, null, F],
      dogma: [{ demand: false, icon: B,
        text: 'Draw three 6s and reveal them. If two or more of the drawn cards are the same color, return the drawn cards and all cards in your hand. Otherwise, keep them.',
        textJa: '6を3枚引いて公開する。2枚以上が同じ色であれば、引いたカードと手札のカードをすべて戻す。そうでなければそのまま持つ。' }] },

    { id: 'coal', name: '石炭', age: 5, color: 'red', icons: [F, F, null, F],
      dogma: [
        { demand: false, icon: F,
          text: 'Draw and tuck a 5.',
          textJa: '5を引いてタックする。' },
        { demand: false, icon: F,
          text: 'You may splay your red cards right.',
          textJa: '赤のカードを右にスプレイしてもよい。' },
        { demand: false, icon: F,
          text: 'You may score any one of your top cards. If you do, also score the card beneath it.',
          textJa: '自分のボードの一番上のカードを1枚得点してもよい。した場合、その下のカードも得点する。' }
      ] },

    { id: 'pirate_code', name: '海賊の掟', age: 5, color: 'red', icons: [F, C, null, C],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer two cards of value 4 or less from your score pile to my score pile!',
        textJa: '【強制】対象プレイヤーは得点パイルから価値4以下のカードを2枚あなたの得点パイルに渡す。' }] },

    { id: 'banking', name: '銀行', age: 5, color: 'blue', icons: [C, null, C, F],
      dogma: [
        { demand: true, icon: C,
          text: 'I DEMAND you transfer a top non-green card with a factory icon from your board to my board! If you do, draw and score a 5!',
          textJa: '【強制】対象プレイヤーは工場アイコン付きの緑以外の一番上のカードをあなたのボードに渡す。渡した場合、対象プレイヤーは5を引いて得点する。' },
        { demand: false, icon: C,
          text: 'You may splay your green cards right.',
          textJa: '緑のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'measurement', name: '測定', age: 5, color: 'blue', icons: [L, B, null, B],
      dogma: [{ demand: false, icon: B,
        text: 'You may return a card from your hand. If you do, choose a color, splay that color right, and draw a card of value equal to the number of cards you have of that color.',
        textJa: '手札からカードを1枚戻してもよい。した場合、色を1つ選んでその色を右にスプレイし、その色のカードの枚数と同じ価値のカードを引く。' }] },

    { id: 'statistics', name: '統計学', age: 5, color: 'yellow', icons: [B, L, null, L],
      dogma: [
        { demand: true, icon: L,
          text: 'I DEMAND you transfer all the highest cards from your score pile to my hand!',
          textJa: '【強制】対象プレイヤーは得点パイルの最高値カードをすべてあなたの手札に渡す。' },
        { demand: false, icon: L,
          text: 'You may splay your yellow cards right.',
          textJa: '黄のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'steam_engine', name: '蒸気機関', age: 5, color: 'yellow', icons: [F, C, F, null],
      dogma: [{ demand: false, icon: F,
        text: 'Draw and tuck two 4s, then score your bottom yellow card.',
        textJa: '4を2枚引いてタックし、その後黄の一番下のカードを得点する。' }] },

    { id: 'astronomy', name: '天文学', age: 5, color: 'purple', icons: [B, B, null, C],
      dogma: [
        { demand: false, icon: B,
          text: 'Draw and reveal a 6. If it is green or blue, meld it and repeat this effect.',
          textJa: '6を引いて公開する。緑または青であればメルドしてこの効果を繰り返す。' },
        { demand: false, icon: B,
          text: 'If all the top cards on your board that are not purple are age 6 or higher, claim the Universe achievement.',
          textJa: '自分のボードの一番上の紫以外のカードがすべて価値6以上であれば、宇宙達成カードを獲得する。' }
      ] },

    { id: 'societies', name: '社会', age: 5, color: 'purple', icons: [null, B, C, C],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer a top non-purple card with a lightbulb icon from your board to my board! If you do, draw a 5!',
        textJa: '【強制】対象プレイヤーは電球アイコン付きの紫以外の一番上のカードをあなたのボードに渡す。渡した場合、対象プレイヤーは5を引く。' }] },

    // ---------------- AGE 6 (10 cards) ----------------
    { id: 'atomic_theory', name: '原子論', age: 6, color: 'green', icons: [B, B, null, B],
      dogma: [
        { demand: false, icon: B,
          text: 'You may splay your blue cards right.',
          textJa: '青のカードを右にスプレイしてもよい。' },
        { demand: false, icon: B,
          text: 'Draw and meld a 7.',
          textJa: '7を引いてメルドする。' }
      ] },

    { id: 'encyclopedia', name: '百科事典', age: 6, color: 'green', icons: [C, C, C, null],
      dogma: [{ demand: false, icon: C,
        text: 'You may meld all the highest value cards in your score pile. If you meld one, you must meld them all.',
        textJa: '得点パイルの最高値カードをすべてメルドしてもよい。1枚メルドする場合はすべてメルドしなければならない。' }] },

    { id: 'industrialization', name: '産業化', age: 6, color: 'red', icons: [F, F, null, C],
      dogma: [
        { demand: false, icon: F,
          text: 'Draw and tuck a 6 for every color on your board with one or more factory icons.',
          textJa: 'ボード上の工場アイコンを1個以上持つ色1つにつき6を引いてタックする。' },
        { demand: false, icon: F,
          text: 'You may splay your red or purple cards right.',
          textJa: '赤または紫のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'machine_tools', name: '工作機械', age: 6, color: 'red', icons: [F, null, F, F],
      dogma: [{ demand: false, icon: F,
        text: 'Draw and score a card of value equal to the highest card in your score pile.',
        textJa: '得点パイルの最高値カードと同じ価値のカードを引いて得点する。' }] },

    { id: 'classification', name: '分類法', age: 6, color: 'blue', icons: [B, B, null, B],
      dogma: [{ demand: false, icon: B,
        text: 'Reveal a card from your hand. Take into your hand the top card of that color from all opponents\' boards.',
        textJa: '手札からカードを1枚公開する。その色の一番上のカードをすべての対戦相手のボードから手札に取る。' }] },

    { id: 'metric_system', name: 'メートル法', age: 6, color: 'blue', icons: [F, C, C, null],
      dogma: [
        { demand: false, icon: C,
          text: 'If your green cards are splayed right, you may splay any one color of your cards right.',
          textJa: '緑のカードが右にスプレイされていれば、自分のカードのうち1色を右にスプレイしてもよい。' },
        { demand: false, icon: C,
          text: 'You may splay your green cards right.',
          textJa: '緑のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'canning', name: '缶詰', age: 6, color: 'yellow', icons: [F, L, F, null],
      dogma: [
        { demand: false, icon: F,
          text: 'You may draw and tuck a 6. If you do, score all your top cards without a factory icon.',
          textJa: '6を引いてタックしてもよい。した場合、工場アイコンのない一番上のカードをすべて得点する。' },
        { demand: false, icon: F,
          text: 'You may splay your yellow cards right.',
          textJa: '黄のカードを右にスプレイしてもよい。' }
      ] },

    { id: 'vaccination', name: 'ワクチン', age: 6, color: 'yellow', icons: [F, L, null, L],
      dogma: [
        { demand: true, icon: L,
          text: 'I DEMAND you return all the lowest cards in your score pile! If you returned any, draw and meld a 6!',
          textJa: '【強制】対象プレイヤーは得点パイルの最低値カードをすべて戻す。戻した場合、対象プレイヤーは6を引いてメルドする。' },
        { demand: false, icon: L,
          text: 'If any card was returned as a result of the demand, draw and meld a 7.',
          textJa: 'この要求でカードが戻されていた場合、7を引いてメルドする。' }
      ] },

    { id: 'democracy', name: '民主主義', age: 6, color: 'purple', icons: [B, B, null, C],
      dogma: [{ demand: false, icon: B,
        text: 'You may return any number of cards from your hand. If you have returned more cards than any other player due to Democracy so far during this dogma action, draw and score an 8.',
        textJa: '手札から好きな数のカードを戻してもよい。このドグマ行動中に民主主義によって戻したカードの合計が他のどのプレイヤーより多ければ、8を引いて得点する。' }] },

    { id: 'emancipation', name: '解放', age: 6, color: 'purple', icons: [B, F, null, F],
      dogma: [
        { demand: true, icon: F,
          text: 'I DEMAND you transfer a card from your hand to my score pile! If you do, draw a 6!',
          textJa: '【強制】対象プレイヤーは手札からカードを1枚あなたの得点パイルに渡す。渡した場合、対象プレイヤーは6を引く。' },
        { demand: false, icon: F,
          text: 'You may splay your red or purple cards right.',
          textJa: '赤または紫のカードを右にスプレイしてもよい。' }
      ] },

    // ---------------- AGE 7 (10 cards) ----------------
    { id: 'evolution', name: '進化論', age: 7, color: 'green', icons: [B, B, null, B],
      dogma: [{ demand: false, icon: B,
        text: 'You may choose to either draw and score an 8 and then return a card from your score pile, or draw a card of value one higher than the highest card in your score pile.',
        textJa: '8を引いて得点し得点パイルからカードを1枚戻すか、得点パイルの最高値カードより価値が1高いカードを引くかを選んでもよい。' }] },

    { id: 'publication', name: '出版', age: 7, color: 'green', icons: [B, K, B, null],
      dogma: [
        { demand: false, icon: B,
          text: 'You may rearrange the order of one color of cards on your board.',
          textJa: '自分のボードの1色のカードの順序を並べ替えてもよい。' },
        { demand: false, icon: B,
          text: 'You may splay your yellow or blue cards up.',
          textJa: '黄または青のカードを上にスプレイしてもよい。' }
      ] },

    { id: 'combustion', name: '燃焼', age: 7, color: 'red', icons: [C, F, null, C],
      dogma: [
        { demand: true, icon: C,
          text: 'I DEMAND you transfer one card from your score pile to my score pile for every four crown icons on my board!',
          textJa: '【強制】あなたのボード上の王冠アイコン4個につき、対象プレイヤーは得点パイルからカードを1枚あなたの得点パイルに渡す。' },
        { demand: false, icon: C,
          text: 'Return your bottom red card.',
          textJa: '自分の赤の一番下のカードを戻す。' }
      ] },

    { id: 'explosives', name: '爆薬', age: 7, color: 'red', icons: [F, F, F, null],
      dogma: [{ demand: true, icon: F,
        text: 'I DEMAND you transfer the three highest cards from your hand to my hand! If you transferred any, and then have no card in hand, draw a 7!',
        textJa: '【強制】対象プレイヤーは手札の最高値カードを3枚あなたの手札に渡す。渡した後、手札がなくなった場合、対象プレイヤーは7を引く。' }] },

    { id: 'bicycle', name: '自転車', age: 7, color: 'blue', icons: [C, K, null, C],
      dogma: [{ demand: false, icon: C,
        text: 'You may exchange all the cards in your hand with all the cards in your score pile. If you exchange one, you must exchange them all.',
        textJa: '手札のカードすべてを得点パイルのカードすべてと交換してもよい。1枚交換する場合はすべて交換しなければならない。' }] },

    { id: 'electricity', name: '電気', age: 7, color: 'blue', icons: [B, null, F, F],
      dogma: [{ demand: false, icon: F,
        text: 'Return all your top cards without a factory icon, then draw an 8 for each card you returned.',
        textJa: '工場アイコンのない一番上のカードをすべて戻し、戻した枚数分だけ8を引く。' }] },

    { id: 'refrigeration', name: '冷蔵', age: 7, color: 'yellow', icons: [L, L, C, null],
      dogma: [
        { demand: true, icon: L,
          text: 'I DEMAND you return half (rounded down) of the cards in your hand!',
          textJa: '【強制】対象プレイヤーは手札の半分（切り捨て）のカードを戻す。' },
        { demand: false, icon: L,
          text: 'You may score a card from your hand.',
          textJa: '手札からカードを1枚得点してもよい。' }
      ] },

    { id: 'sanitation', name: '公衆衛生', age: 7, color: 'yellow', icons: [L, null, L, L],
      dogma: [{ demand: true, icon: L,
        text: 'I DEMAND you exchange the two highest cards in your hand with the lowest card in my hand!',
        textJa: '【強制】対象プレイヤーは手札の最高値カード2枚を、あなたの手札の最低値カードと交換する。' }] },

    { id: 'lighting', name: '照明', age: 7, color: 'purple', icons: [L, K, L, null],
      dogma: [{ demand: false, icon: L,
        text: 'You may tuck up to three cards from your hand. If you do, draw and score a 7 for every different value of card you tucked.',
        textJa: '手札から最大3枚のカードをタックしてもよい。した場合、タックしたカードの異なる価値1種につき7を引いて得点する。' }] },

    { id: 'railroad', name: '鉄道', age: 7, color: 'purple', icons: [F, K, null, K],
      dogma: [
        { demand: false, icon: K,
          text: 'Return all cards from your hand, then draw three 6s.',
          textJa: '手札のカードをすべて戻し、その後6を3枚引く。' },
        { demand: false, icon: K,
          text: 'You may splay up any one color of your cards currently splayed right.',
          textJa: '右にスプレイしている色のうち1つを上にスプレイしてもよい。' }
      ] },

    // ---------------- AGE 8 (10 cards) ----------------
    { id: 'quantum_theory', name: '量子論', age: 8, color: 'green', icons: [K, K, null, K],
      dogma: [{ demand: false, icon: K,
        text: 'You may return up to two cards from your hand. If you return two, draw a 10 and then draw and score a 10.',
        textJa: '手札から最大2枚のカードを戻してもよい。2枚戻した場合、10を引き、さらに10を引いて得点する。' }] },

    { id: 'rocketry', name: 'ロケット工学', age: 8, color: 'green', icons: [K, K, null, K],
      dogma: [{ demand: false, icon: K,
        text: 'Return a card in any opponent\'s score pile for every two clock icons on your board.',
        textJa: 'ボード上の時計アイコン2個につき、任意の対戦相手の得点パイルからカードを1枚戻す。' }] },

    { id: 'flight', name: '飛行', age: 8, color: 'red', icons: [null, K, C, C],
      dogma: [
        { demand: false, icon: C,
          text: 'If your red cards are splayed up, you may splay any one color of your cards up.',
          textJa: '赤のカードが上にスプレイされていれば、自分のカードのうち1色を上にスプレイしてもよい。' },
        { demand: false, icon: C,
          text: 'You may splay your red cards up.',
          textJa: '赤のカードを上にスプレイしてもよい。' }
      ] },

    { id: 'mobility', name: '移動性', age: 8, color: 'red', icons: [F, K, F, null],
      dogma: [{ demand: true, icon: F,
        text: 'I DEMAND you transfer the two highest non-red top cards without a factory icon from your board to my score pile! If you transferred any cards, draw an 8!',
        textJa: '【強制】対象プレイヤーはボードの一番上の赤以外のカードのうち、工場アイコンのない最高値の2枚をあなたの得点パイルに渡す。渡した場合、対象プレイヤーは8を引く。' }] },

    { id: 'corporations', name: '大企業', age: 8, color: 'blue', icons: [F, F, C, null],
      dogma: [
        { demand: true, icon: F,
          text: 'I DEMAND you transfer a top non-green card with a factory icon from your board to my score pile! If you do, draw and meld an 8!',
          textJa: '【強制】対象プレイヤーは工場アイコン付きの緑以外の一番上のカードをあなたの得点パイルに渡す。渡した場合、対象プレイヤーは8を引いてメルドする。' },
        { demand: false, icon: F,
          text: 'Draw and meld an 8.',
          textJa: '8を引いてメルドする。' }
      ] },

    { id: 'mass_media', name: 'マスメディア', age: 8, color: 'blue', icons: [null, K, B, B],
      dogma: [
        { demand: false, icon: B,
          text: 'You may return a card from your hand. If you do, choose a value, and return all cards of that value from all score piles.',
          textJa: '手札からカードを1枚戻してもよい。した場合、価値を1つ選び、すべての得点パイルからその価値のカードをすべて戻す。' },
        { demand: false, icon: B,
          text: 'You may splay your purple cards up.',
          textJa: '紫のカードを上にスプレイしてもよい。' }
      ] },

    { id: 'antibiotics', name: '抗生物質', age: 8, color: 'yellow', icons: [L, L, null, L],
      dogma: [{ demand: false, icon: L,
        text: 'You may return up to three cards from your hand. For every different value of card that you returned, draw two 8s.',
        textJa: '手札から最大3枚のカードを戻してもよい。戻したカードの異なる価値1種につき8を2枚引く。' }] },

    { id: 'skyscrapers', name: '高層建築', age: 8, color: 'yellow', icons: [F, C, C, null],
      dogma: [{ demand: true, icon: C,
        text: 'I DEMAND you transfer a top non-yellow card with a clock icon from your board to my board! If you do, score the card beneath it, and return all other cards from that pile!',
        textJa: '【強制】対象プレイヤーは時計アイコン付きの黄以外の一番上のカードをあなたのボードに渡す。渡した場合、その下のカードを得点し、そのパイルの残りのカードをすべて戻す。' }] },

    { id: 'empiricism', name: '経験主義', age: 8, color: 'purple', icons: [B, B, null, B],
      dogma: [
        { demand: false, icon: B,
          text: 'Choose two colors, then draw and reveal a 9. If it is either of the colors you chose, meld it and you may splay your cards of that color up.',
          textJa: '2色を選び、9を引いて公開する。選んだ色のいずれかであればメルドし、その色を上にスプレイしてもよい。' },
        { demand: false, icon: B,
          text: 'If you have twenty or more lightbulb icons on your board, you win.',
          textJa: 'ボード上に電球アイコンが20個以上あれば、あなたの勝利です。' }
      ] },

    { id: 'socialism', name: '社会主義', age: 8, color: 'purple', icons: [null, L, L, L],
      dogma: [{ demand: false, icon: L,
        text: 'You may tuck all cards from your hand. If you tuck one, you must tuck them all. If you tucked at least one purple card, take all the lowest cards in each other player\'s hand into your hand.',
        textJa: '手札のカードをすべてタックしてもよい。1枚タックする場合はすべてタックしなければならない。紫のカードを1枚以上タックした場合、他のすべてのプレイヤーの手札の最低値カードをすべて自分の手札に取る。' }] },

    // ---------------- AGE 9 (10 cards) ----------------
    { id: 'computers', name: 'コンピュータ', age: 9, color: 'green', icons: [null, K, F, K],
      dogma: [
        { demand: false, icon: K,
          text: 'You may splay your red or green cards up.',
          textJa: '赤または緑のカードを上にスプレイしてもよい。' },
        { demand: false, icon: K,
          text: 'Draw and meld a 10, then execute each of its non-demand dogma effects. Do not share them.',
          textJa: '10を引いてメルドし、そのカードの非強制ドグマ効果をすべて実行する。これらは共有しない。' }
      ] },

    { id: 'genetics', name: '遺伝学', age: 9, color: 'green', icons: [B, B, null, B],
      dogma: [{ demand: false, icon: B,
        text: 'Draw and meld a 10. Score all cards beneath it.',
        textJa: '10を引いてメルドする。その下のカードをすべて得点する。' }] },

    { id: 'composites', name: '複合材料', age: 9, color: 'red', icons: [F, null, F, F],
      dogma: [{ demand: true, icon: F,
        text: 'I DEMAND you transfer all but one card from your hand to my hand! Also transfer the highest card from your score pile to my score pile!',
        textJa: '【強制】対象プレイヤーは手札から1枚を残して残りをすべてあなたの手札に渡す。さらに得点パイルの最高値カードをあなたの得点パイルに渡す。' }] },

    { id: 'fission', name: '核分裂', age: 9, color: 'red', icons: [K, K, K, null],
      dogma: [
        { demand: true, icon: K,
          text: 'I DEMAND you draw a 10! If it is red, remove all hands, boards, and score piles from the game! If this occurs, the dogma action is complete.',
          textJa: '【強制】対象プレイヤーは10を引く。それが赤であれば、すべてのプレイヤーの手札・ボード・得点パイルをゲームから除外する。この場合、ドグマ行動は終了する。' },
        { demand: false, icon: K,
          text: 'Return a top card other than Fission from any player\'s board. Draw a 10.',
          textJa: '任意のプレイヤーのボードの一番上のカード（核分裂以外）を1枚戻す。10を引く。' }
      ] },

    { id: 'collaboration', name: '協調', age: 9, color: 'blue', icons: [C, K, C, null],
      dogma: [
        { demand: true, icon: C,
          text: 'I DEMAND you draw two 9s and reveal them! I transfer the card of my choice to my board, and you meld the other!',
          textJa: '【強制】対象プレイヤーは9を2枚引いて公開する。あなたはそのうち1枚を選んで自分のボードに移す。対象プレイヤーはもう1枚をメルドする。' },
        { demand: false, icon: C,
          text: 'If you have ten or more green cards on your board, you win.',
          textJa: 'ボード上に緑のカードが10枚以上あれば、あなたの勝利です。' }
      ] },

    { id: 'satellites', name: '人工衛星', age: 9, color: 'blue', icons: [K, K, K, null],
      dogma: [
        { demand: false, icon: K,
          text: 'Return all cards from your hand, and draw three 8s.',
          textJa: '手札のカードをすべて戻し、8を3枚引く。' },
        { demand: false, icon: K,
          text: 'You may splay your purple cards up.',
          textJa: '紫のカードを上にスプレイしてもよい。' },
        { demand: false, icon: K,
          text: 'Meld a card from your hand and then execute each of its non-demand dogma effects. Do not share them.',
          textJa: '手札からカードを1枚メルドし、そのカードの非強制ドグマ効果をすべて実行する。これらは共有しない。' }
      ] },

    { id: 'ecology', name: '生態学', age: 9, color: 'yellow', icons: [B, B, null, L],
      dogma: [{ demand: false, icon: B,
        text: 'You may return a card from your hand. If you do, score a card from your hand and draw two 10s.',
        textJa: '手札からカードを1枚戻してもよい。した場合、手札からカードを1枚得点し、10を2枚引く。' }] },

    { id: 'suburbia', name: '郊外', age: 9, color: 'yellow', icons: [C, L, L, null],
      dogma: [{ demand: false, icon: L,
        text: 'You may tuck any number of cards from your hand. Draw and score a 1 for each card you tuck.',
        textJa: '手札から好きな数のカードをタックしてもよい。タックした枚数分だけ1を引いて得点する。' }] },

    { id: 'services', name: 'サービス', age: 9, color: 'purple', icons: [F, L, F, null],
      dogma: [{ demand: true, icon: F,
        text: 'I DEMAND you transfer all the highest cards from your score pile to my hand! If you transferred any cards, then transfer a top card from my board without a leaf icon to your hand!',
        textJa: '【強制】対象プレイヤーは得点パイルの最高値カードをすべてあなたの手札に渡す。渡した場合、あなたのボードの一番上の葉アイコンのないカードを対象プレイヤーの手札に渡す。' }] },

    { id: 'specialization', name: '専門化', age: 9, color: 'purple', icons: [F, L, F, null],
      dogma: [
        { demand: false, icon: F,
          text: 'Reveal a card from your hand. Take into your hand the top card of that color from all opponents\' boards.',
          textJa: '手札からカードを1枚公開する。その色の一番上のカードをすべての対戦相手のボードから手札に取る。' },
        { demand: false, icon: F,
          text: 'You may splay your yellow or blue cards up.',
          textJa: '黄または青のカードを上にスプレイしてもよい。' }
      ] },

    // ---------------- AGE 10 (10 cards) ----------------
    { id: 'bioengineering', name: '生体工学', age: 10, color: 'green', icons: [K, K, null, B],
      dogma: [
        { demand: false, icon: K,
          text: 'Transfer a top card with a leaf icon from any opponent\'s board to your score pile.',
          textJa: '任意の対戦相手のボードの一番上の葉アイコン付きカードを自分の得点パイルに移す。' },
        { demand: false, icon: K,
          text: 'If any player has fewer than three leaf icons on their board, the single player with the most leaf icons on their board wins.',
          textJa: 'いずれかのプレイヤーのボードの葉アイコンが3個未満であれば、ボード上の葉アイコンが最も多い1人のプレイヤーが勝利する。' }
      ] },

    { id: 'software', name: 'ソフトウェア', age: 10, color: 'green', icons: [null, K, null, K],
      dogma: [
        { demand: false, icon: K,
          text: 'Draw and score a 10.',
          textJa: '10を引いて得点する。' },
        { demand: false, icon: K,
          text: 'Draw and meld two 10s, then execute each of the second card\'s non-demand dogma effects. Do not share them.',
          textJa: '10を2枚引いてメルドし、2枚目のカードの非強制ドグマ効果をすべて実行する。これらは共有しない。' }
      ] },

    { id: 'miniaturization', name: '小型化', age: 10, color: 'red', icons: [B, K, B, null],
      dogma: [{ demand: false, icon: B,
        text: 'You may return a card from your hand. If you returned a 10, draw a 10 for every different value of card in your score pile.',
        textJa: '手札からカードを1枚戻してもよい。戻したカードが10であれば、得点パイルにある異なる価値1種につき10を引く。' }] },

    { id: 'robotics', name: 'ロボット工学', age: 10, color: 'red', icons: [F, null, F, null],
      dogma: [{ demand: false, icon: F,
        text: 'Score your top green card. Draw and meld a 10, then execute each of its non-demand dogma effects. Do not share them.',
        textJa: '自分のボードの一番上の緑カードを得点する。10を引いてメルドし、そのカードの非強制ドグマ効果をすべて実行する。これらは共有しない。' }] },

    { id: 'databases', name: 'データベース', age: 10, color: 'blue', icons: [K, K, K, null],
      dogma: [{ demand: true, icon: K,
        text: 'I DEMAND you return half (rounded up) of the cards in your score pile!',
        textJa: '【強制】対象プレイヤーは得点パイルの半分（切り上げ）のカードを戻す。' }] },

    { id: 'self_service', name: 'セルフサービス', age: 10, color: 'blue', icons: [C, null, C, null],
      dogma: [
        { demand: false, icon: C,
          text: 'Execute each of the non-demand dogma effects of any other top card on your board. Do not share them.',
          textJa: '自分のボードの他の一番上のカードのどれか1枚の非強制ドグマ効果をすべて実行する。これらは共有しない。' },
        { demand: false, icon: C,
          text: 'If you have more achievements than each other player, you win.',
          textJa: '他のすべてのプレイヤーより達成カードが多ければ、あなたの勝利です。' }
      ] },

    { id: 'globalization', name: 'グローバル化', age: 10, color: 'yellow', icons: [F, F, F, null],
      dogma: [
        { demand: true, icon: F,
          text: 'I DEMAND you return a top card with a leaf icon from your board!',
          textJa: '【強制】対象プレイヤーはボードの一番上の葉アイコン付きカードを戻す。' },
        { demand: false, icon: F,
          text: 'Draw and score a 6. If no player has more leaf icons than factory icons on their board, the single player with the most points wins.',
          textJa: '6を引いて得点する。どのプレイヤーもボード上の葉アイコンが工場アイコンより多くなければ、得点が最も多い1人のプレイヤーが勝利する。' }
      ] },

    { id: 'stem_cells', name: '幹細胞', age: 10, color: 'yellow', icons: [L, L, L, null],
      dogma: [{ demand: false, icon: L,
        text: 'You may score all cards from your hand. If you score one, you must score them all.',
        textJa: '手札のカードをすべて得点してもよい。1枚得点する場合はすべて得点しなければならない。' }] },

    { id: 'ai', name: 'A.I.', age: 10, color: 'purple', icons: [B, K, null, B],
      dogma: [
        { demand: false, icon: B,
          text: 'Draw and score a 10.',
          textJa: '10を引いて得点する。' },
        { demand: false, icon: B,
          text: 'If Robotics and Software are top cards on any board, the single player with the lowest score wins.',
          textJa: 'ロボット工学とソフトウェアがどかのプレイヤーのボードの一番上にある場合、得点が最も低い1人のプレイヤーが勝利する。' }
      ] },

    { id: 'the_internet', name: 'インターネット', age: 10, color: 'purple', icons: [K, null, null, null],
      dogma: [
        { demand: false, icon: K,
          text: 'You may splay your green cards up.',
          textJa: '緑のカードを上にスプレイしてもよい。' },
        { demand: false, icon: K,
          text: 'Draw and score a 10.',
          textJa: '10を引いて得点する。' },
        { demand: false, icon: K,
          text: 'Draw and meld a 10 for every two clock icons on your board.',
          textJa: 'ボード上の時計アイコン2個につき10を引いてメルドする。' }
      ] }
  ];

  return CARDS;
});
