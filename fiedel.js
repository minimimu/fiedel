(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";

var
  fiedel       = {},
  _            = require("./util"),
  Audio        = require("./audio"),
  Sequencer    = require("./sequencer/sequencer"),
  Loader       = require("./loader"),
  PreciseTimer = require("./precise-timer");

global.AudioContext = global.AudioContext || global.webkitAudioContext;

fiedel.use = function(context) {
  if(!(context instanceof global.AudioContext)) {
    throw new TypeError("fiedel.use(): must be an audio context");
  }
  fiedel.Audio     = Audio(context);
  fiedel.Sequencer = Sequencer(context);
  fiedel.Loader    = Loader;
};

fiedel.Audio = fiedel.Sequencer = fiedel.Loader = function() {
  throw new Error("please use fiedel.use() at first");
};

fiedel.PreciseTimer = PreciseTimer;

global.fiedel = fiedel;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./audio":2,"./loader":4,"./precise-timer":5,"./sequencer/sequencer":6,"./util":13}],2:[function(require,module,exports){
"use strict"

var
  _            = require("./util"),
  Events       = require("./events"),
  PreciseTimer = require("./precise-timer");

module.exports = function($context) {
  function Audio(options) {
    options = _.defaults(options, {});
    this.buffer = null;
    this.duration = 0;
    this.length = 0;
    this.offset = _.defaults(options.offset, 0);
    this.loop = _.defaults(options.loop, false);
    this.gainNode = $context.createGain();
    this.gainNode.gain.value = _.defaults(options.volume, 1);
    this._toDestination = $context.destination;
    this._playing = null;
    this._booking = {};
    this._connected = [];
    this._timerpool = [];

    var
      connections = [this.gainNode],
      givenConnections = options.connections;
    if (givenConnections) {
      if (_.isArray(givenConnections)) {
        connections.push.apply(connections, givenConnections);
      } else {
        connections.push(givenConnections);
      }
    }

    this.connect(connections);

    this.on("play", onplay);

    Object.defineProperties(this, {
      id: {
        value: _.uid("a"),
        enumerable: true
      },
      volume: {
        get: function() {
          return this.gainNode.gain.value;
        },
        set: function(v) {
          this.gainNode.gain.value = v;
        },
        enumerable: true
      },
      isPlaying: {
        get: function() {
          return !!this._playing;
        },
        enumerable: true
      }
    });
  }

  _.extend(Audio, {

    load: function(url, options) {
      if (!url) {
        return reject(Error("Audio.load(): You must pass a url"));
      }

      var self = this;
      options = _.defaults(options, {});

      return _.defer(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.send();
        request.onload = function() {
          decode(request.response).then(function(bufferObject) {
            var obj = self instanceof Audio ? self : new self;
            options.url = url;
            resolve(_.extend(obj, options, bufferObject));
          }, function() {
            reject(Error("Decoding the audio has gone wrong"));
          });
        };
      });
    },

    fromFile: function(file, options) {
      if (_.typeOf(file) !== "file") {
        return reject(Error("This argument you passed is not file object"));
      }

      var self = this;
      options = _.defaults(options, {});

      return _.defer(function(resolve, reject) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(file);
        request.onload = function(e) {
          decode(e.target.result).then(function(bufferObject) {
            var obj = self instanceof Audio ? self : new self;
            options.filename = file.name;
            resolve(_.extend(obj, options, bufferObject));
          }, function() {
            reject(Error("Decoding the file object was failed: Please make sure file object is proper."));
          });
        };
      });
    }

  });

  _.extend(Audio.prototype, Events, {

    load: function(url, options) {
      var self = this;
      url = _.defaults(url, self.url);
      options = _.defaults(options, {});

      return _.defer(function(resolve, reject) {
        self.constructor.load.call(self, url, options).then(function() {
          resolve(self);
        }, function(error) {
          reject(error);
        });
      });
    },

    fromFile: function(file, options) {
      var self = this;
      options = _.defaults(options, {});

      return _.defer(function(resolve, reject) {
        self.constructor.fromFile.call(self, file, options).then(function() {
          resolve(self);
        }, function(error) {
          reject(error);
        });
      });
    },

    play: function(offset, length) {
      var source;
      offset = _.defaults(offset, this.offset);
      length = _.defaults(length, this.length);

      source = setBufferSource.call(this, 0, offset, length);
      this.trigger("play", source);
      return this;
    },

    book: function(time, offset, length) {
      var source, timer, bookingId;
      time = _.defaults(time, 0);
      offset = _.defaults(offset, this.offset);
      length = _.defaults(length, this.length);

      if (time <= 0) {
        return this.play(offset, length);
      }

      source = setBufferSource.call(this, time, offset, length);
      timer = source._.timer = getTimer.call(this);
      timer.setTimeout(_.proxy(function() {
        source._.timer.using = false;
        delete this._booking[source._.bookingId];
        this.trigger("play", source);
      }, this), time * 1000);

      bookingId = source._.bookingId = $context.currentTime + time;
      this._booking[bookingId] = source;
      return bookingId;
    },

    stop: function(time) {
      if (!this.isPlaying) return this;
      this._playing.stop($context.currentTime + _.defaults(time, 0));
      return this;
    },

    cancel: function(ids) {
      var
        i, len, bookingId, s, id, source,
        booking = this._booking,
        canceled = [];

      if (ids) {
        if(!_.isArray(ids)) ids = [ids];
        booking = {};
        for (i = 0, len = ids.length; i < len; i++) {
          bookingId = ids[i];
          if (s = this._booking[bookingId]) {
            booking[bookingId] = s;
          }
        }
      }

      for (id in booking) {
        source = booking[id];
        source._.timer.clearTimeout();
        delete this._booking[id];
        source.stop(0);
        canceled.push(source);
      }

      if (canceled.length) {
        this.trigger("cancel", canceled);
      }

      return canceled;
    },

    destroy: function() {
      this.cancel();
      this.buffer = this._timerpool = this._connected = null;
      this.trigger("destroy");
      this.off();
    },

    connect: function(connections) {
      var i, len, from;

      if (!connections) {
        return this;
      }

      if (!_.isArray(connections)) {
        connections = [connections];
      }

      for (i = 0, len = connections.length; i < len; i++) {
        from = connections[i];
        if (typeof from === "function") {
          from = from.call($context);
        }

        from.connect(this._toDestination);
        this._toDestination = from;
        this._connected.push(from);
      }
    }

  });

  function decode(audioSource) {
    return _.defer(function(resolve, reject) {
      $context.decodeAudioData(audioSource, function(b) {
        resolve({
          buffer: b,
          duration: b.duration,
          length: b.duration
        });
      }, reject);
    });
  }

  function onplay(source) {
    if (this.isPlaying) {
      this._playing._.abort = true;
      this._playing.stop(0);
    }
    this._playing = source;
  }

  function getTimer() {
    var
      i, len, t, timer,
      pool = this._timerpool;

    for (i = 0, len = pool.length; i < len; i++) {
      t = pool[i];
      if (!t.using) {
        timer = t;
        break;
      }
    }

    if (!timer) {
      timer = new PreciseTimer();
      pool.push(timer);
    }

    timer.using = true;
    return timer;
  }

  function setBufferSource(time, offset, length) {
    var
      source = $context.createBufferSource(),
      duration = this.duration;

    source._ = {};
    source.buffer = this.buffer;

    offset = offset % duration;
    if (length > duration) length = duration;
    time = source._.startTime = time + $context.currentTime;
    source._.duration = (length - offset) < 0 ? 0 : length - offset;
    source.start(time, offset, length);
    source.onended = _.proxy(onSourceEnd, this);
    source.connect(this._toDestination);
    return source;
  }

  function onSourceEnd(e) {
    var
      source = e.target,
      endTime = $context.currentTime - source._.startTime;

    if (source === this._playing) {
      this._playing = null;
    }

    if (this.loop) {
      this.play();
      this.trigger("loop");
    } else if (source._.duration <= endTime) {
      this.trigger("end");
    } else if (source._.abort) {
      this.trigger("abort");
    } else {
      this.trigger("stop");
    }

  }

  return Audio;
};

},{"./events":3,"./precise-timer":5,"./util":13}],3:[function(require,module,exports){
"use strict";

module.exports = {

  on: function(name, callback, context) {
    var events;
    if (!callback) return this;
    this._events || (this._events = {});
    events = this._events[name] || (this._events[name] = []);
    events.push({
      callback: callback,
      context: context || this
    });
    return this;
  },

  off: function(name, callback) {
    var event, events, retain, i, len;
    if (!this._events) {
      return this;
    }
    if (!name && !callback) {
      this._events = void 0;
      return this;
    }
    if (events = this._events[name]) {
      this._events[name] = retain = [];
      if (callback) {
        for (i = 0, len = events.length; i < len; i++) {
          event = events[_i];
          if (callback && callback !== event.callback) {
            retain.push(event);
          }
        }
      }
      if (!retain.length) {
        delete this._events[name];
      }
    }
    return this;
  },

  trigger: function(name) {
    var args, callback, context, event, events, i, len;
    args = Array.prototype.slice.call(arguments, 1);
    if (!this._events) {
      return this;
    }
    if (events = this._events[name]) {
      for (i = 0, len = events.length; i < len; i++) {
        event = events[i], callback = event.callback, context = event.context;
        callback.apply(context, args);
      }
    }
    return this;
  }

};

},{}],4:[function(require,module,exports){
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

},{"./util":13}],5:[function(require,module,exports){
(function (global){
"use strict";

var
  workerScript, workerPath, URL,
  _ = require("./util");

workerScript = ""
  + "var i = t = 0;"
  + "onmessage = function(e) {"
  +   "if (e.data.timer === 'interval') {"
  +     "if (i) {"
  +       "i = clearInterval(i);"
  +     "}"
  +     "if (typeof e.data.time === 'number' && e.data.time >= 0) {"
  +       "i = setInterval(function() {"
  +         "postMessage('interval');"
  +       "}, e.data.time);"
  +     "}"
  +   "} else if ( e.data.timer === 'timeout' ) {"
  +     "if (t) {"
  +       "t = clearTimeout(t);"
  +     "}"
  +     "if (typeof e.data.time === 'number' && e.data.time >= 0) {"
  +       "t = setTimeout(function() {"
  +         "postMessage('timeout');"
  +       "}, e.data.time);"
  +     "}"
  +   "}"
  + "};";

if ((URL = global.URL || global.webkitURL) && typeof global.Blob === "function") {
  workerPath = URL.createObjectURL(new Blob([workerScript], {type: "text/javascript"}));
}

function PreciseTimer() {
  if (workerPath) {
    try {
      this.timer = new Worker(workerPath);
      this.timer.onmessage = (function(self){
        return function(e) {
          if (e.data === "interval") {
            self.interval();
          } else {
            self.timeout();
          }
        };
      })(this);
    } catch (error) {
      this.timer = [];
    }
  } else {
    this.timer = [];
  }
}

_.extend(PreciseTimer.prototype, {

  setInterval: function(f, interval) {
    interval = _.defaults(interval, 100);
    this._setTimer("interval", f, interval);
  },

  setTimeout: function(f, timeout) {
    timeout = _.defaults(timeout, 100);
    this._setTimer("timeout", f, timeout);
  },

  clearInterval: function() {
    this._clearTimer("interval");
  },

  clearTimeout: function() {
    this._clearTimer("timeout");
  },

  _setTimer: function(timer, f, time) {
    var isInterval = timer === "interval";

    if (_.isArray(this.timer)) {
      if (isInterval) {
        this.timer[0] = setInterval(f, time);
      } else {
        this.timer[1] = setTimeout(f, time);
      }
    } else {
      if (isInterval) {
        this.interval = f;
      } else {
        this.timeout = f;
      }
      this.timer.postMessage({
        timer: timer,
        time: time
      });
    }
  },

  _clearTimer: function(timer) {
    if (_.isArray(this.timer)) {
      if (timer === "interval") {
        clearInterval(this.timer[0]);
      } else {
        clearTimeout(this.timer[1]);
      }
    } else {
      this.timer.postMessage({
        timer: timer,
        time: -1
      });
    }
  }

});

module.exports = PreciseTimer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./util":13}],6:[function(require,module,exports){
"use strict";

var
  _            = require("../util"),
  Events       = require("../events"),
  PreciseTimer = require("../precise-timer"),
  Loader       = require("../loader"),
  Track        = require("./track"),

  aliasSpliter = /^(\S+)\s*(.*)$/,
  aliasReg = /(?:.*\/)?(\S+?)(?:\..*)?$/,

  defaultSequencerState = {
    startNoteIndex: 0,
    nextNoteIndex:  0,
    nextNoteTime:   0,
    startTime:      0,
    resumeTime:     0,
    scheduledTime:  0,
    startedNote:    0,
    playing:        false
  };

module.exports = function($context) {
  function Sequencer(options) {
    options            = _.defaults(options, {});
    this.loop          = _.defaults(options.loop, true);
    this.bpm           = _.defaults(options.bpm, 120);
    this.note          = _.defaults(options.note, 16);
    this.startNote     = _.defaults(options.startNote, 0);
    this.tableLength   = _.defaults(options.tableLength, 8);
    this.lookAhead     = _.defaults(options.lookAhead, 25.0);
    this.scheduleAhead = _.defaults(options.scheduleAhead, 0.1);
    this.notetable     = [];
    this.tracks        = [];
    this.sourceMap     = {};
    this._byId         = {};
    this._byNote       = {};
    this._muting       = [];
    this._timer        = new PreciseTimer();
    this._state        = _.extend({}, defaultSequencerState);

    Object.defineProperties(this, {
      id: {
        value: _.uid("s"),
        enumerable: true
      },
      onebeat: {
        get: function() {
          return (60.0 / this.bpm) * (4 / this.note);
        },
        enumerable: true
      },
      isPlaying: {
        get: function() {
          return this._state.playing;
        },
        enumerable: true
      }
    });
  }

  _.extend(Sequencer.prototype, Events, {

    load: function(urlMap, options) {
      var
        i, len, _ref, url, urls, matched,
        alias, aliasMap, self,
        base = "",
        ext = "";

      if (!urlMap || !_.isArray(urls = urlMap.urls)) {
        throw new TypeError("Sequencer.load(): First argument must have a urls property as array");
      }

      if ((_ref = urlMap.base) && typeof _ref === "string") {
        base = _ref;
        delete urlMap["base"];
      }
      if ((_ref = urlMap.ext) && typeof _ref === "string") {
        ext = _ref;
        delete urlMap["ext"];
      }

      aliasMap = {};
      for (i = 0, len = urls.length; i < len; i++) {
        if (matched = urls[i].match(aliasSpliter)) {
          url = matched[1], alias = matched[2];
          url = base + url + ext;
          if (alias === "") {
            alias = (_ref = url.match(aliasReg)) ? _ref[1] : url;
            aliasMap[url] = alias;
          } else {
            aliasMap[url] = alias;
          }
          urls[i] = url;
        }
      }

      self = this;
      return Loader(urlMap, options).then(function(result) {
        var
          audio, alias,
          sourceMap = {},
          audios = result.audios;

        for (i = 0, len = audios.length; i < len; i++) {
          audio = audios[i];
          alias = aliasMap[audio.url];
          sourceMap[alias] = audio;
        }

        self.preset(sourceMap);

        return result;
      });
    },

    start: function() {
      if (this.isPlaying) return;
      prepare.call(this, "start", {startTime: $context.currentTime});
      schedule.call(this);
      this.trigger("start");
      return this;
    },

    stop: function() {
      if (!this.isPlaying) return;
      prepare.call(this, "stop");
      this._timer.clearTimeout();
      this.trigger("stop");
      return this;
    },

    getTrackIds: function() {
      var id, ids  = [],
        byId = this._byId;

      for (id in byId) {
        ids.push(id);
      }
      return ids;
    },

    getSourceNames: function() {
      var name, names = [],
        map = this.sourceMap;

      for (name in map) {
        names.push(name);
      }
      return names;
    },

    get: function(id) {
      return this._byId[id];
    },

    find: function(query) {
      var i, len, result, results, track, obj;
      if (!query) return void 0;
      if (typeof query === "function") {
        results = this.tracks.filter(function(t) {
          return query(t.attributes);
        });
      } else if (_.typeOf(obj = query) === "object") {
        results = this.tracks.filter(function(t) {
          var key,
            attrs = t.attributes,
            matched = [];
          for (key in obj) {
            matched.push(attrs[key] === obj[key]);
          }
          return matched.length && (matched.filter(function(m) {
            return m;
          })).length === matched.length;
        });
      } else {
        results = [];
      }
      return results;
    },

    which: function(note) {
      var _ref;
      return (_ref = this._byNote[note]) ? _.clone(_ref) : void 0;
    },

    getMuting: function() {
      return _.clone(this._muting);
    },

    isMuted: function(trackId) {
      if (isTrack(trackId)) {
        trackId = trackId.id;
      }
      return _.within(this._muting, trackId);
    },

    muteOn: function(tracks) {
      return this.mute(tracks, true);
    },

    muteOff: function(tracks) {
      return this.mute(tracks, false);
    },

    mute: function(tracks, OnOff) {
      var
        i, j, len, _len, _ref, trackId, id, ids,
        track, index, exist, muteOn, result,
        affected = {},
        toggle = typeof OnOff !== "boolean";

      if (tracks) {
        if (!_.isArray(tracks)) tracks = [tracks];
        ids = [];
        for (i = 0, len = tracks.length; i < len ; i++) {
          track = tracks[i];
          if (isTrack(track)) {
            ids.push(track.id);
          } else if (typeof track === "string") {
            _ref = this.get(track);
            if (_ref) ids.push(_ref.id);
          } else {
            _ref = this.find(track);
            if (_ref.length) {
              for (j = 0, _len = _ref.length; j < _len; j++) {
                ids.push(_ref[j].id);
              }
            }
          }
        }
      } else {
        ids = this.getTrackIds();
      }

      if (ids.length) {
        for (i = 0, len = ids.length; i < len; i++) {
          id = ids[i];
          index = _.indexOf(this._muting, id);
          exist = index !== -1;
          muteOn = toggle ? !exist : OnOff;
          if (muteOn && !exist) {
            this._muting.push(id);
            (affected.on || (affected.on = [])).push(id);
          } else if (!muteOn && exist) {
            this._muting.splice(index, 1);
            (affected.off || (affected.off = [])).push(id);
          }
        }
      }
      if (toggle) {
        result = affected;
      } else if (OnOff) {
        result = affected.on;
      } else {
        result = affected.off;
      }
      return result;
    },

    preset: function(name, source, options) {
      var override, nameMap, plural, exists = [];
      if (name == null) return false;
      if (typeof name === "object") {
        nameMap = name;
        options = source;
      } else {
        (nameMap = {})[name] = source;
      }
      options = _.defaults(options, {});
      override = options.override;
      for (name in nameMap) {
        source = nameMap[name];
        if (this.sourceMap[name] && !override) {
          exists.push(name);
        }
      }
      if (exists.length) {
        plural = 1 < exists.length ? " have " : " has ";
        throw Error(exists.join(", ") + plural + "been setted already");
      } else {
        _.extend(this.sourceMap, nameMap);
      }
      return this;
    },

    unset: function(name) {
      var i, len, tracks = this.tracks;
      if (name != null && _.has(this.sourceMap, name)) {
        delete this.sourceMap[name];
        for (i = 0, len = tracks.length; i < len; i++) {
          tracks[i].unrecord(name);
        }
        return this;
      }
      return false;
    },

    createTrack: function(generator) {
      var track, attrs;
      generator = _.defaults(generator, {});
      if (generator.attributes) {
        attrs = generator.attributes;
      } else {
        attrs = {};
      }
      track = new Track(attrs, this);
      track.on("record", addNote, this);
      track.on("unrecord", subtractNote, this);
      this.tracks.push(track);
      this._byId[track.id] = track;
      if (generator.record) track.record(generator.record);
      return track;
    },

    remove: function(tracks) {
      var
        i, len, index, singular, track,
        removed = [];

      singular = !_.isArray(tracks);
      tracks = singular ? [tracks] : tracks;
      for (i = 0, len = tracks.length; i < len; i++) {
        track = tracks[i];
        track = isTrack(track) ? track : this.get(track);
        if (!track) continue;
        delete this._byId[track.id];
        index = _.indexOf(this.tracks, track);
        this.tracks.splice(index, 1);
        track.reset();
        delete track.sequencer;
        track.off();
        (removed || (removed = [])).push(track);
      }
      return singular ? removed[0] : removed;
    }

  });

  function isAudio(audio) {
    return audio instanceof fiedel.Audio;
  }

  function isTrack(track) {
    return track instanceof Track;
  }

  function addNote(track) {
    var
      i, len, note, storedNote,
      needsSort = false,
      id        = track.id,
      notetable = track.notetable;

    for (i = 0, len = notetable.length; i < len; i++) {
      note = notetable[i];
      storedNote = this._byNote[note] || (this._byNote[note] = []);
      if (!_.within(storedNote, id)) storedNote.push(id);
      if (!_.within(this.notetable, note)) {
        this.notetable.push(note);
        needsSort = true;
      }
    }
    if (needsSort) {
      this.notetable.sort(function(a, b) { return a - b; });
    }
  }

  function subtractNote(track, lackMap) {
    var index, note, trackIds;
    for (note in lackMap) {
      if (!track.which(note)) {
        trackIds = this._byNote[note];
        index = _.indexOf(trackIds, track.id);
        trackIds.splice(index, 1);
        if (!trackIds.length) {
          index = _.indexOf(this.notetable, Number(note));
          this.notetable.splice(index, 1);
          delete this._byNote[note];
        }
      }
    }
  }

  function prepare(scheduleType, stateOptions) {
    stateOptions = _.defaults(stateOptions, {});
    if (scheduleType === "start") {
      stateOptions.playing = true;
      stateOptions.startedNote = this.startNote;
    }
    _.extend(this._state, defaultSequencerState, stateOptions);
  }

  function schedule() {
    var
      i, j, len, _len, _ref,
      diffNote, diffNoteTime, endTime,
      lastNote, nextNote, relatedTrackIds,
      relatedTables, track, result, schedulingTime,
      source, time, withoutCurrentTime,

      startTime         = this._state.startTime,
      currentTime       = $context.currentTime,
      scheduleAhead     = this.scheduleAhead,
      scheduleTime      = currentTime - startTime + scheduleAhead,
      onebeat           = this.onebeat,
      startNote         = this.startNote,
      startNoteTime     = startNote * onebeat,
      incrementalNote   = 0,
      tableLength       = this.tableLength,
      startNoteIndex    = this._state.startNoteIndex,
      nextNoteIndex     = this._state.nextNoteIndex,
      nextNoteTime      = this._state.nextNoteTime,
      lastStartedNote   = this._state.startedNote,
      lastScheduledTime = this._state.scheduledTime,
      schedulingTable   = this.notetable,
      isEnd             = false;

    while (true) {
      nextNote = schedulingTable[nextNoteIndex];
      lastNote = (_ref = schedulingTable[nextNoteIndex - 1]) != null ? _ref : 0;
      endTime = nextNoteTime + ((tableLength - lastNote) * onebeat);

      if (endTime <= scheduleTime) {
        isEnd = true;
        break;
      } else if (nextNote == null) {
        break;
      } else if (nextNote < startNote) {
        startNoteIndex = ++nextNoteIndex;
        incrementalNote += nextNote - lastNote;
        continue;
      }

      if (lastStartedNote < startNote && lastNote < startNote) {
        if (lastScheduledTime < nextNoteTime + ((incrementalNote + startNote - lastNote) * onebeat)) {
          nextNoteTime = scheduleTime - scheduleAhead;
          startNoteIndex = nextNoteIndex;
        }
      }

      diffNote = startNoteIndex === nextNoteIndex ? startNote : lastNote;
      diffNoteTime = (nextNote - diffNote) * onebeat;
      if (nextNoteTime + diffNoteTime < lastScheduledTime) {
        nextNoteTime = scheduleTime - scheduleAhead - diffNoteTime;
      }

      schedulingTime = nextNoteTime + diffNoteTime;
      if (!(schedulingTime < scheduleTime)) {
        break;
      }

      nextNoteIndex++;
      nextNoteTime += diffNoteTime;
      relatedTrackIds = this._byNote[nextNote];
      if (relatedTrackIds && _.isArray(relatedTrackIds)) {
        time = startTime + schedulingTime;
        withoutCurrentTime = time - currentTime;
        for (i = 0, len = relatedTrackIds.length; i < len; i++) {
          track = this.get(relatedTrackIds[i]);
          if (!track || this.isMuted(track.id)) {
            continue;
          }
          relatedTables = track.which(nextNote);
          if (!relatedTables && !_.isArray(relatedTables)) {
            continue;
          }
          for (j = 0, _len = relatedTables.length; j < _len; j++) {
            source = this.sourceMap[relatedTables[j]];
            if (isAudio(source)) {
              source.book(withoutCurrentTime);
            } else if (_.typeOf(source) === "function") {
              result = source.call(this, nextNote, withoutCurrentTime, time);
              if (result && isAudio(result)) {
                result.book(withoutCurrentTime);
              }
            }
          }
        }
      }

      this.trigger("schedule", nextNote);
    }

    this._state.startNoteIndex = startNoteIndex;
    this._state.nextNoteIndex  = nextNoteIndex;
    this._state.nextNoteTime   = nextNoteTime;
    this._state.scheduledTime  = scheduleTime;
    this._state.startedNote    = startNote;

    if (isEnd && this.loop) {
      prepare.call(this, "start", {startTime: startTime + endTime});
      this.trigger("loop");
    } else if (isEnd) {
      prepare.call(this, "stop");
      this.trigger("end", endTime);
      return;
    }

    this._timer.setTimeout(_.proxy(schedule, this), this.lookAhead);
  }

  return Sequencer;
};

},{"../events":3,"../loader":4,"../precise-timer":5,"../util":13,"./track":7}],7:[function(require,module,exports){
"use strict";

var
  _      = require("../util"),
  Events = require("../events");

function Track(attributes, sequencer) {
  this.tables     = [];
  this.attributes = {};
  this.sequencer  = sequencer;
  this._bySource  = {};
  this._byNote    = {};

  this.set(attributes);

  Object.defineProperties(this, {
    id: {
      value: _.uid("t"),
      enumerable: true
    },
    muted: {
      get: function() {
        return this.sequencer.isMuted(this.id);
      },
      enumerable: true
    },
    notetable: {
      get: function() {
        var note,
          byNote = this._byNote,
          notetable = [];

        for (note in byNote) {
          notetable.push(Number(note));
        }
        notetable.sort(function(a,b) { return a - b; });
        return notetable;
      },
      enumerable: true
    }
  });
}

_.extend(Track.prototype, Events, {

  get: function(key) {
    return this.attributes[key];
  },

  set: function(key, val) {
    var attrs;

    if (key == null) return this;
    if (typeof key === "object") {
      attrs = key;
    } else {
      (attrs = {})[key] = val;
    }
    _.extend(this.attributes, attrs);
    return this;
  },

  unset: function(key) {
    delete this.attributes[key];
    return this;
  },

  reset: function() {
    var lackMap = this._byNote;
    this._byNote = {};
    this._bySource = {};
    this.attributes = {};
    this.tables = [];
    this.muteOff();
    this.trigger("unrecord", this, lackMap);
    return this;
  },

  which: function(note) {
    var _ref;
    return (_ref = this._byNote[note]) ? _.clone(_ref) : void 0;
  },

  getTableSources: function() {
    var source, sources  = [],
      bySource = this._bySource;

    for (source in bySource) {
      sources.push(source);
    }
    return sources;
  },

  getTable: function(source) {
    return this._bySource[source];
  },

  muteOn: function() {
   this.mute(true);
  },

  muteOff: function() {
   this.mute(false);
  },

  mute: function(OnOff) {
   this.sequencer.mute(this.id, OnOff);
  },

  record: function(source, notes) {
    var
      i, len, recordingTable, recordingTables, recordingObj,
      table, note, newNotes, newNotesMap, needsSort;

    if (source == null) return this;
    if (typeof source === "object") {
      recordingObj = source;
    } else {
      (recordingObj = {})[source] = notes;
    }

    recordingTables = [];
    for (source in recordingObj) {
      notes = recordingObj[source];
      if (!this.sequencer.sourceMap[source]) {
        throw new Error("You need to set an audio source before recording");
      }
      if (typeof notes === "number") {
        notes = [notes];
      } else if (_.isArray(notes) && _.isUnity("number", notes)) {
        notes.sort(function(a, b) { return a - b; });
      } else {
        throw new TypeError("You need to pass either integer or array of integers as a timetable");
      }
      recordingTables.push({
        source: source,
        notes: _.clone(notes)
      });
    }

    newNotesMap = {};
    for (i = 0, len = recordingTables.length; i < len; i++) {
      recordingTable = recordingTables[i];
      source = recordingTable.source;
      notes  = recordingTable.notes;
      table  = this.getTable(source);
      if (table) {
        newNotes = _.merge(table.notes, notes);
        if (newNotes.length) {
          table.notes.sort(function(a, b) { return a - b; });
        }
      } else {
        this.tables.push(recordingTable);
        this._bySource[source] = recordingTable;
        newNotes = notes;
      }
      if (newNotes.length) {
        newNotesMap[source] || (newNotesMap[source] = []);
        _.merge(newNotesMap[source], newNotes);
      }
    }

    if (!Object.keys(newNotesMap).length) return this;

    for (source in newNotesMap) {
      newNotes = newNotesMap[source];
      for (i = 0, len = newNotes.length; i < len; i++) {
        note = newNotes[i];
        (this._byNote[note] || (this._byNote[note] = [])).push(source);
      }
    }
    this.trigger("record", this, newNotesMap);
    return this;
  },

  unrecord: function(source, notes) {
    var
      i, len, index, sources, table, note, notes,
      storedNotes, remain, lack, lackMap, unrecorded,
      unrecordingNotes, unrecordingObj;

    if (source == null) return this;
    if (typeof source === "object") {
      unrecordingObj = source;
    } else {
      (unrecordingObj = {})[source] = notes;
    }

    lackMap = {};
    for (source in unrecordingObj) {
      unrecordingNotes = unrecordingObj[source];
      table = this._bySource[source];
      // throw error if table is not exist
      if (!table) continue;
      notes = table.notes;
      table.notes = remain = [];
      if (unrecordingNotes != null) {
        for (i = 0, len = notes.length; i < len; i++) {
          note = notes[i];
          if (!_.within(unrecordingNotes, note)) {
            remain.push(note);
          }
        }
      }
      if (!remain.length) {
        index = _.indexOf(this.tables, table);
        this.tables.splice(index, 1);
        delete this._bySource[source];
        lack = notes;
      } else {
        lack = _.lack(notes, remain);
      }
      for (i = 0, len = lack.length; i < len; i++) {
        note = lack[i];
        (lackMap[note] || (lackMap[note] = [])).push(source);
      }
    }

    if (!Object.keys(lackMap).length) return this;

    for (note in lackMap) {
      lack = lackMap[note];
      sources = this._byNote[note];
      this._byNote[note] = remain = [];
      for (i = 0, len = sources.length; i < len; i++) {
        source = sources[i];
        if (!_.within(lack, source)) remain.push(source);
      }
      if (!remain.length) {
        delete this._byNote[note];
      }
    }
    this.trigger("unrecord", this, lackMap);
    return this;
  }

});

module.exports = Track;

},{"../events":3,"../util":13}],8:[function(require,module,exports){
"use strict";

var
  typeOf = require("./typeof"),
  extend = require("./extend");

module.exports = function(obj) {
  var result;
  if (typeOf(obj) === "array") {
    result = obj.slice();
  } else {
    result = extend({}, obj);
  }
  return result;
};

},{"./extend":11,"./typeof":18}],9:[function(require,module,exports){
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

},{"./typeof":18}],10:[function(require,module,exports){
"use strict";

module.exports = function(f) {
  return new Promise(function(resolve, reject) {
    f(resolve, reject);
  });
};

},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
"use strict";

var hasOwnProperty = {}.hasOwnProperty;

module.exports = function(obj, prop) {
  return hasOwnProperty.call(obj, prop);
};

},{}],13:[function(require,module,exports){
"use strict";

var _ = {};

_.typeOf = require("./typeof");

_.indexOf = require("./indexof");

_.within = require("./within");

_.has = require("./has");

_.extend = require("./extend");

_.clone = require("./clone");

_.merge = require("./merge");

_.defer = require("./defer");

_.unity = require("./unity");

_.uid = require("./uid");

_.defaults = require("./defaults");

_.lack = require("./lack");

_.proxy = require("./proxy");

_.isArray = function(arr) {
  return _.typeOf(arr) === "array";
};

_.isUnity = function(expectation, target) {
  if (typeof expectation !== "string") {
    expectation = _.typeOf(expectation);
  }
  return expectation === _.unity(target);
};

module.exports = _;

},{"./clone":8,"./defaults":9,"./defer":10,"./extend":11,"./has":12,"./indexof":14,"./lack":15,"./merge":16,"./proxy":17,"./typeof":18,"./uid":19,"./unity":20,"./within":21}],14:[function(require,module,exports){
"use strict";

module.exports = function(array, value) {
  return Array.prototype.indexOf.call(array, value);
};

},{}],15:[function(require,module,exports){
"use strict";

var within = require("./within");

module.exports = function(left, right) {
  var val, lack;
  lack = left.filter(function(v) {
    return !within(right, v);
  });
  return lack;
};

},{"./within":21}],16:[function(require,module,exports){
"use strict";

var
  defaults = require("./defaults"),
  clone = require("./clone"),
  within = require("./within");

module.exports = function(to, from, duplicate) {
  var i, len, val, merged;
  duplicate = defaults(duplicate, false);

  if (duplicate) {
    to.push.apply(to, from);
    merged = clone(from);
  } else {
    merged = [];
    for (i = 0, len = from.length; i < len; i++) {
      val = from[i];
      if (!within(to, val)) {
        to.push(val);
        merged.push(val);
      }
    }
  }

  return merged;
};

},{"./clone":8,"./defaults":9,"./within":21}],17:[function(require,module,exports){
"use strict";

var slice = Array.prototype.slice;

module.exports = function(f, context) {
  var arg = slice.call(arguments, 2);
  return function() {
    f.apply(context, arg.concat(slice.call(arguments)));
  };
};

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
"use strict";

var
  within = require("./within"),
  typeOf = require("./typeof"),
  primitives = ["string", "number", "boolean", "undefined"];

module.exports = function(target) {
  var i, len, name, value, types, std, filtered;

  if (within(primitives, typeof target)) {
    return typeof target;
  }

  types = [];
  if (typeOf(target) === "array") {
    for (i = 0, len = target.length; i < len; i++) {
      value = target[i];
      types.push(typeOf(value));
    }
  } else if (typeOf(target) === "object") {
    for (name in target) {
      value = target[name];
      types.push(typeOf(value));
    }
  }

  std = types[0];
  filtered = types.filter(function(t) {
    return std === t;
  });

  if (filtered.length === types.length) {
    return std;
  } else {
    return false;
  }
};

},{"./typeof":18,"./within":21}],21:[function(require,module,exports){
"use strict";

var indexOf = require("./indexof");

module.exports = function(array, value) {
  return indexOf(array, value) >= 0;
};

},{"./indexof":14}]},{},[1]);
