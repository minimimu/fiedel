"use strict";

var within = require("./within");

module.exports = function(left, right) {
  var val, lack;
  lack = left.filter(function(v) {
    return !within(right, v);
  });
  return lack;
};
