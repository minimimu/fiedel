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
