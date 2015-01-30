"use strict";

var _ = {};

_.typeOf = require("./typeof");

_.indexOf = require("./indexof");

_.within = require("./within");

_.has = require("./has");

_.extend = require("./extend");

_.clone = require("./clone");

_.merge = require("./merge");

_.defer = require("./defer");

_.unity = require("./unity");

_.uid = require("./uid");

_.defaults = require("./defaults");

_.lack = require("./lack");

_.proxy = require("./proxy");

_.isArray = function(arr) {
  return _.typeOf(arr) === "array";
};

_.isUnity = function(expectation, target) {
  if (typeof expectation !== "string") {
    expectation = _.typeOf(expectation);
  }
  return expectation === _.unity(target);
};

module.exports = _;
