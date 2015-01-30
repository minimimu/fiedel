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
