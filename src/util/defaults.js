"use strict";

var typeOf = require("./typeof");

// module.exports = function(value, defaultValue, type) {
//   if (typeof type !== "string") type = _typeof(type);
//   console.log(_typeof(value), type, _typeof(value) !== type);
//   return _typeof(value) !== type ? value : defaultValue;
// };
module.exports = function(value, defaultValue) {
  return typeof value !== "undefined" ? value : defaultValue;
};
