"use strict";

var indexOf = require("./indexof");

module.exports = function(array, value) {
  return indexOf(array, value) >= 0;
};
