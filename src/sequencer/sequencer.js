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
