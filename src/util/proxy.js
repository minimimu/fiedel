"use strict";

var slice = Array.prototype.slice;

module.exports = function(f, context) {
  var arg = slice.call(arguments, 2);
  return function() {
    f.apply(context, arg.concat(slice.call(arguments)));
  };
};
