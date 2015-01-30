"use strict";

var _       = require("./util");

module.exports = function(urlMap, options) {
  if (!urlMap || !_.isArray(urlMap.urls)) {
    throw new TypeError("Loader(): First argument must have a urls property as array");
  }
  options = _.defaults(options, {});

  return _.defer(function(resolve, reject) {
    var
      i, len, _ref, url, audio,
      base = "",
      ext = "",
      promises = [],
      byUrl = {},
      urls = urlMap.urls;

    if ((_ref = urlMap.base) && typeof _ref === "string") {
      base = _ref;
    }
    if ((_ref = urlMap.ext) && typeof _ref === "string") {
      ext = _ref;
    }

    for (i = 0, len = urls.length; i < len; i++) {
      url = base + urls[i] + ext;
      promises.push(fiedel.Audio.load(url, _.extend({}, options)));
    }

    Promise.all(promises).then(function(audios) {
      for (i = 0, len = audios.length; i < len; i++) {
        audio = audios[i];
        byUrl[audio.url] = audio;
      }
      resolve({
        audios: audios,
        byUrl: byUrl
      });
    }, reject);
  });
};
