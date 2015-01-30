"use strict";

var
  i, len, name,
  classTypes    = {},
  toString     = classTypes.toString,
  stringsArray = (""
    + "Boolean Number String Function "
    + "Array Date RegExp Object "
    + "Error FileList File ArrayBuffer").split(" ");

for (i = 0, len = stringsArray.length; i < len; i++) {
  name = stringsArray[i];
  classTypes[ "[object " + name + "]" ] = name.toLowerCase();
}

module.exports = function(obj) {
  var type;
  if (obj == null) return obj + "";

  if (typeof obj === "object" || typeof obj === "function") {
    type = classTypes[toString.call(obj)] || "object";
  } else {
    type = typeof obj
  }

  return type;
};
