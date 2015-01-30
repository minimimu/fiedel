"use strict";

var hasOwnProperty = {}.hasOwnProperty;

module.exports = function(obj, prop) {
  return hasOwnProperty.call(obj, prop);
};
