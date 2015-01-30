"use strict";

var
  within = require("./within"),
  typeOf = require("./typeof"),
  primitives = ["string", "number", "boolean", "undefined"];

module.exports = function(target) {
  var i, len, name, value, types, std, filtered;

  if (within(primitives, typeof target)) {
    return typeof target;
  }

  types = [];
  if (typeOf(target) === "array") {
    for (i = 0, len = target.length; i < len; i++) {
      value = target[i];
      types.push(typeOf(value));
    }
  } else if (typeOf(target) === "object") {
    for (name in target) {
      value = target[name];
      types.push(typeOf(value));
    }
  }

  std = types[0];
  filtered = types.filter(function(t) {
    return std === t;
  });

  if (filtered.length === types.length) {
    return std;
  } else {
    return false;
  }
};
