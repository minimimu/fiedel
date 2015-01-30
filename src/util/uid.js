"use strict";

var ids;

ids = {
  f: 0,
  a: 0,
  s: 0,
  t: 0
};

module.exports = function(prefix) {
  if (ids[prefix] == null) {
    prefix = "f";
  }
  return prefix + (++ids[prefix]);
};
