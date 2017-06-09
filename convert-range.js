const nodeSemver = require('semver');
const { Semver, SemverRange } = require('./sver');

module.exports = function nodeRangeToSemverRange (range) {
  try {
    return new SemverRange(range);
  }
  catch (e) {
    if (e.code !== 'ENOTSEMVER')
      throw e;
  }

  range = nodeSemver.validRange(range);

  // tag or wildcard
  if (!range || range === '*')
    return new SemverRange(range);

  let outRange;
  for (let union of range.split('||')) {

    // compute the intersection into a lowest upper bound and a highest lower bound
    let upperBound, lowerBound, upperEq, lowerEq;
    for (let intersection of union.split(' ')) {
      let lt = intersection[0] === '<';
      let gt = intersection[0] === '>';
      let eq = (lt || gt) && intersection[1] === '=';
      if (!gt) {
        let version = new Semver(intersection.substr(1 + eq));
        if (!upperBound || upperBound.gt(version)) {
          upperBound = version;
          upperEq = eq;
        }
      }
      else if (!lt) {
        let eq = intersection[1] === '=';
        let version = new Semver(intersection.substr(1 + eq));
        if (!upperBound || lowerBound.lt(version)) {
          lowerBound = version;
          lowerEq = eq;
        }
      }
    }

    // if the lower bound is greater than the upper bound then just return the lower bound exactly
    if (lowerBound && upperBound && lowerBound.gt(upperBound))
      return new SemverRange(lowerBound.toString());

    // determine the largest semver range satisfying the upper bound
    let upperRange;
    if (upperBound) {
      // if the upper bound has an equality then we return it directly
      if (upperEq)
        return new SemverRange(upperBound.toString());

      // prerelease ignored in upper bound
      let major = 0, minor = 0, patch = 0, rangeType = '';

      // <2.0.0 -> ^1.0.0
      if (upperBound.patch === 0) {
        if (upperBound.minor === 0) {
          if (upperBound.major > 0) {
            major = upperBound.major - 1;
            rangeType = '^';
          }
        }
        // <1.2.0 -> ~1.1.0
        else {
          major = upperBound.major;
          minor = upperBound.minor - 1;
          rangeType = '~';
        }
      }
      // <1.2.3 -> ~1.2.0
      else {
        major = upperBound.major;
        minor = upperBound.minor;
        patch = 0;
        rangeType = '~';
      }

      upperRange = new SemverRange(rangeType + major + '.' + minor + '.' + patch);
    }

    // determine the lower range semver range
    let lowerRange;
    if (!lowerEq) {
      if (lowerBound.pre)
        lowerRange = new SemverRange('^' + lowerBound.major + '.' + lowerBound.minor + '.' + lowerBound.patch + '-' + [...lowerBound.pre, 1]);
      else
        lowerRange = new SemverRange('^' + lowerBound.major + '.' + lowerBound.minor + '.' + (lowerBound.patch + 1));
    }
    else {
      lowerRange = new SemverRange('^' + lowerBound.toString());
    }

    // we then intersect the upper semver range with the lower semver range
    // if the intersection is empty, we return the upper range only
    let curRange = lowerRange.intersect(upperRange) || upperRange;

    // the higher union range wins
    if (!outRange || curRange.gt(outRange))
      outRange = curRange;
  }
  return outRange;
}
