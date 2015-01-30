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
