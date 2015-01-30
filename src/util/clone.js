"use strict";

var
  typeOf = require("./typeof"),
  extend = require("./extend");

module.exports = function(obj) {
  var result;
  if (typeOf(obj) === "array") {
    result = obj.slice();
  } else {
    result = extend({}, obj);
  }
  return result;
};
