"use strict";

var
  defaults = require("./defaults"),
  clone = require("./clone"),
  within = require("./within");

module.exports = function(to, from, duplicate) {
  var i, len, val, merged;
  duplicate = defaults(duplicate, false);

  if (duplicate) {
    to.push.apply(to, from);
    merged = clone(from);
  } else {
    merged = [];
    for (i = 0, len = from.length; i < len; i++) {
      val = from[i];
      if (!within(to, val)) {
        to.push(val);
        merged.push(val);
      }
    }
  }

  return merged;
};
