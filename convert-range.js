const { SemverRange } = require('./sver');

module.exports = function nodeRangeToSemverRange (range) {
  return new SemverRange(range);
};
