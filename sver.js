'use strict';

const shortSemverRegEx = /^(0|[1-9]\d*)(\.(?:0|[1-9]\d*))?$/;
const semverRegEx = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-z-]+(?:\.[\da-z-]+)*)(?:\+([\da-z-]+(?:\.[\da-z-]+)*)?)?)?$/i;
const validTagRegEx = /^[^=<>@\/\\ ][^|#\/\\ @]+$/;

const MAJOR = Symbol('major');
const MINOR = Symbol('minor');
const PATCH = Symbol('patch');
const PRE = Symbol('pre');
const TAG = Symbol('tag');

let numRegEx = /^\d+$/;
class Semver {
  constructor (version) {
    let semver = version.match(semverRegEx);
    if (!semver) {
      if (!version.match(validTagRegEx)) {
        let e = new TypeError(`"${version}" is not a valid exact version.`);
        e.code = 'ENOTSEMVER';
        throw e;
      }
      this[TAG] = version;
      return;
    }
    if (semver[2] === undefined || semver[3] === undefined) {
      let e = new TypeError(`"${version}" is not an exact version.`);
      e.code = 'ENOTSEMVER';
      throw e;
    }
    this[MAJOR] = parseInt(semver[1], 10);
    this[MINOR] = parseInt(semver[2], 10);
    this[PATCH] = parseInt(semver[3], 10);
    this[PRE] = semver[4] && semver[4].split('.');
  }
  gt (version) {
    return Semver.compare(this, version) === 1;
  }
  lt (version) {
    return Semver.compare(this, version) === -1;
  }
  eq (version) {
    if (!(version instanceof Semver))
      version = new Semver(version);

    if (this[TAG] && version[TAG])
      return this[TAG] === version[TAG];
    if (this[TAG] || version[TAG])
      return false;
    if (this[MAJOR] !== version[MAJOR])
      return false;
    if (this[MINOR] !== version[MINOR])
      return false;
    if (this[PATCH] !== version[PATCH])
      return false;
    if (this[PRE] === undefined && version[PRE] === undefined)
      return true;
    if (this[PRE] === undefined || version[PRE] === undefined)
      return false;
    if (this[PRE].length !== version[PRE].length)
      return false;
    for (let i = 0; i < this[PRE].length; i++) {
      if (this[PRE][i] !== version[PRE][i])
        return false;
    }
    return true;
  }
  matches (range, unstable = false) {
    if (!(range instanceof SemverRange))
      range = new SemverRange(range);
    return range.has(this, unstable);
  }
  toString () {
    if (this[TAG])
      return this[TAG];
    return this[MAJOR] + '.' + this[MINOR] + '.' + this[PATCH] + (this[PRE] ? '-' + this[PRE].join('.') : '');
  }
  static isValid (version) {
    let semver = version.match(semverRegEx);
    if (!semver) {
      if (version.match(validTagRegEx))
        return false;
      return true;
    }
    if (semver[2] === undefined || semver[3] === undefined)
      return false;
    return true;
  }
  static compare (v1, v2) {
    if (!(v1 instanceof Semver))
      v1 = new Semver(v1);
    if (!(v2 instanceof Semver))
      v2 = new Semver(v2);

    // not semvers - tags have equal precedence
    if (v1[TAG] && v2[TAG])
      return 0;
    // semver beats tag version
    if (v1[TAG])
      return -1;
    if (v2[TAG])
      return 1;
    // compare version numbers
    if (v1[MAJOR] !== v2[MAJOR])
      return v1[MAJOR] > v2[MAJOR] ? 1 : -1;
    if (v1[MINOR] !== v2[MINOR])
      return v1[MINOR] > v2[MINOR] ? 1 : -1;
    if (v1[PATCH] !== v2[PATCH])
      return v1[PATCH] > v2[PATCH] ? 1 : -1;
    if (!v1[PRE] && !v2[PRE])
      return 0;
    if (!v1[PRE])
      return 1;
    if (!v2[PRE])
      return -1;
    // prerelease comparison
    for (let i = 0, l = Math.min(v1[PRE].length, v2[PRE].length); i < l; i++) {
      if (v1[PRE][i] !== v2[PRE][i]) {
        let isNum1 = v1[PRE][i].match(numRegEx);
        let isNum2 = v2[PRE][i].match(numRegEx);
        // numeric has lower precedence
        if (isNum1 && !isNum2)
          return -1;
        if (isNum2 && !isNum1)
          return 1;
        // compare parts
        if (isNum1 && isNum2)
          return parseInt(v1[PRE][i], 10) > parseInt(v2[PRE][i], 10) ? 1 : -1;
        else
          return v1[PRE][i] > v2[PRE][i] ? 1 : -1;
      }
    }
    if (v1[PRE].length === v2[PRE].length)
      return 0;
    // more pre-release fields win if equal
    return v1[PRE].length > v2[PRE].length ? 1 : -1;
  }
}
exports.Semver = Semver;

const WILDCARD_RANGE = 0;
const MAJOR_RANGE = 1;
const STABLE_RANGE = 2;
const EXACT_RANGE = 3;

const TYPE = Symbol('type');
const VERSION = Symbol('version');

class SemverRange {
  constructor (versionRange) {
    if (versionRange === '*') {
      this[TYPE] = WILDCARD_RANGE;
      return;
    }
    let shortSemver = versionRange.match(shortSemverRegEx);
    if (shortSemver) {
      if (shortSemver[2] === undefined) {
        this[VERSION] = new Semver(versionRange + '.0.0');
        this[TYPE] = MAJOR_RANGE;
      }
      else {
        this[VERSION] = new Semver(versionRange + '.0');
        this[TYPE] = STABLE_RANGE;
      }
      this[VERSION][PRE] = this[VERSION][PRE] || [];
    }
    else if (versionRange[0] === '^') {
      this[VERSION] = new Semver(versionRange.substr(1));
      if (this[VERSION][MAJOR] === 0) {
        if (this[VERSION][MINOR] === 0)
          this[TYPE] = EXACT_RANGE;
        else
          this[TYPE] = STABLE_RANGE;
      }
      else {
        this[TYPE] = MAJOR_RANGE;
      }
    }
    else if (versionRange[0] === '~') {
      this[VERSION] = new Semver(versionRange.substr(1));
      this[TYPE] = STABLE_RANGE;
    }
    else {
      this[VERSION] = new Semver(versionRange);
      this[TYPE] = EXACT_RANGE;
    }
    if (this[VERSION][TAG] && this[TYPE] !== EXACT_RANGE) {
      let e = new TypeError("Semver range %" + versionRange + "% is not supported.");
      e.code = 'ENOTSEMVER';
      throw e;
    }
  }
  get isWildcard () {
    return this[TYPE] === WILDCARD_RANGE;
  }
  get isMajor () {
    return this[TYPE] === MAJOR_RANGE;
  }
  get isStable () {
    return this[TYPE] === STABLE_RANGE;
  }
  get isExact () {
    return this[TYPE] === EXACT_RANGE;
  }
  gt (range) {
    return SemverRange.compare(this, range) === 1;
  }
  lt (range) {
    return SemverRange.compare(this, range) === -1;
  }
  eq (range) {
    return SemverRange.compare(this, range) === 0;
  }
  has (version, unstable = false) {
    if (!(version instanceof Semver))
      version = new Semver(version);
    if (this[TYPE] === WILDCARD_RANGE)
      return true;
    if (this[TYPE] === EXACT_RANGE)
      return this[VERSION].eq(version);
    if (version[TAG])
      return false;
    if (version.lt(this[VERSION]))
      return false;
    if (version[PRE] && !unstable)
      return this[VERSION][MAJOR] === version[MAJOR] && this[VERSION][MINOR] === version[MINOR] && this[VERSION][PATCH] === version[PATCH];
    if (this[TYPE] === MAJOR_RANGE)
      return this[VERSION][MAJOR] === version[MAJOR];
    return this[VERSION][MAJOR] === version[MAJOR] && this[VERSION][MINOR] === version[MINOR];
  }
  contains (range) {
    if (!(range instanceof SemverRange))
      range = new SemverRange(range);
    if (this[TYPE] === WILDCARD_RANGE)
      return true;
    if (range[TYPE] === WILDCARD_RANGE)
      return false;
    return range[TYPE] >= this[TYPE] && this.has(range[VERSION], true);
  }
  intersect (range) {
    if (!(range instanceof SemverRange))
      range = new SemverRange(range);

    if (this[TYPE] === WILDCARD_RANGE && range[TYPE] === WILDCARD_RANGE)
      return this;
    if (this[TYPE] === WILDCARD_RANGE)
      return range;
    if (range[TYPE] === WILDCARD_RANGE)
      return this;

    if (this[TYPE] === EXACT_RANGE)
      return range.has(this[VERSION], true) ? this : undefined;
    if (range[TYPE] === EXACT_RANGE)
      return this.has(range[VERSION], true) ? range : undefined;

    let higherRange, lowerRange, polarity;
    if (range[VERSION].gt(this[VERSION])) {
      higherRange = range;
      lowerRange = this;
      polarity = true;
    }
    else {
      higherRange = this;
      lowerRange = range;
      polarity = false;
    }

    if (!lowerRange.has(higherRange[VERSION], true))
      return;

    if (lowerRange[TYPE] === MAJOR_RANGE)
      return polarity ? range : this;

    let intersection = new SemverRange(higherRange[VERSION].toString());
    intersection[TYPE] = STABLE_RANGE;
    return intersection;
  }
  bestMatch (versions, unstable = false) {
    let maxSemver;
    versions.forEach(version => {
      if (!(version instanceof Semver))
        version = new Semver(version);
      if (!this.has(version, unstable))
        return;
      if (!unstable && version[PRE]) {
        if (this[TYPE] === WILDCARD_RANGE || !this[VERSION][PRE] || this[VERSION][MAJOR] !== version[MAJOR] ||
            this[VERSION][MINOR] !== version[MINOR] || this[VERSION][PATCH] !== version[PATCH])
          return;
      }
      if (!maxSemver) {
        maxSemver = version;
      }
      else if (Semver.compare(version, maxSemver) === 1) {
        maxSemver = version;
      }
    });
    return maxSemver;
  }
  toString () {
    switch (this[TYPE]) {
      case WILDCARD_RANGE:
        return '*';
      case MAJOR_RANGE:
        return '^' + this[VERSION].toString();
      case STABLE_RANGE:
        return '~' + this[VERSION].toString();
      case EXACT_RANGE:
        return this[VERSION].toString();
    }
  }
  static match (range, version, unstable = false) {
    if (!(version instanceof Semver))
      version = new Semver(version);
    return version.matches(range, unstable);
  }
  static isValid (range) {
    try {
      new SemverRange(range);
    }
    catch (e) {
      return false;
    }
    return true;
  }
  static compare (r1, r2) {
    if (!(r1 instanceof SemverRange))
      r1 = new SemverRange(r1);
    if (!(r2 instanceof SemverRange))
      r2 = new SemverRange(r2);
    if (r1[TYPE] === WILDCARD_RANGE && r2[TYPE] === WILDCARD_RANGE)
      return 0;
    if (r1[TYPE] === WILDCARD_RANGE)
      return 1;
    if (r2[TYPE] === WILDCARD_RANGE)
      return -1;
    let cmp = Semver.compare(r1[VERSION], r2[VERSION]);
    if (cmp !== 0) {
      return cmp;
    }
    if (r1[TYPE] === r2[TYPE])
      return 0;
    return r1[TYPE] > r2[TYPE] ? 1 : -1;
  }
}
exports.SemverRange = SemverRange;
