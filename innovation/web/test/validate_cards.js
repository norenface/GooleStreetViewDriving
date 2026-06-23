var cards = require('../js/cards.js');
var ok = true;

function fail(msg) { ok = false; console.error('FAIL: ' + msg); }

if (cards.length !== 105) fail('expected 105 cards, got ' + cards.length);

var byAge = {};
var ids = {}, names = {};
cards.forEach(function (c) {
  byAge[c.age] = (byAge[c.age] || 0) + 1;
  if (ids[c.id]) fail('duplicate id ' + c.id);
  ids[c.id] = true;
  if (names[c.name]) fail('duplicate name ' + c.name);
  names[c.name] = true;
  if (!Array.isArray(c.icons) || c.icons.length !== 4) fail(c.id + ' icons must have length 4');
  if (!Array.isArray(c.dogma) || c.dogma.length < 1) fail(c.id + ' must have at least one dogma effect');
  ['yellow', 'red', 'green', 'blue', 'purple'].indexOf(c.color) === -1 && fail(c.id + ' invalid color ' + c.color);
});

for (var age = 1; age <= 10; age++) {
  var expected = age === 1 ? 15 : 10;
  if (byAge[age] !== expected) fail('age ' + age + ' expected ' + expected + ' cards, got ' + (byAge[age] || 0));
}

if (ok) console.log('OK: 105 unique cards, correct per-age counts, all icons/dogma present.');
else process.exit(1);
