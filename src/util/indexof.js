"use strict";

module.exports = function(array, value) {
  return Array.prototype.indexOf.call(array, value);
};
