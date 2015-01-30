"use strict";

module.exports = function(f) {
  return new Promise(function(resolve, reject) {
    f(resolve, reject);
  });
};
