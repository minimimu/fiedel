"use strict";

module.exports = function(target) {
  var
    len, source, name, i = 0,
    sources = Array.prototype.slice.call(arguments, 1);

  for (i, len = sources.length; i < len; i++) {
    if (source = sources[i]) {
      for (name in source) {
        target[name] = source[name];
      }
    }
  }

  return target;
};
