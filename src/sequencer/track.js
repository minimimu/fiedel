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
