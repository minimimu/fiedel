"use strict";

describe("Track", function() {
  var
    ctx, sequencer, track,
    source = function(){};

  beforeEach(function() {
    ctx = new AudioContext;
    fiedel.use(ctx);
    sequencer = new fiedel.Sequencer();
    sequencer.preset({
      hihat: source,
      snare: source,
      kick:  source
    });
    track = sequencer.createTrack({
      attributes: {
        name: "drums"
      }
    });
    track.record({
      hihat: [0,1,2],
      kick:  [0,2]
    });
  });

  describe("#get(key)", function() {
    it("should return a value setted via #set() method.", function() {
      expect(track.get("name")).to.equal("drums");
    });
  });

  describe("#set(key, value)", function() {
    it("should set and store that as key-to-value", function() {
      expect(track.get("genra")).to.be.undefined;
      track.set("genra", "rock");
      expect(track.get("genra")).to.equal("rock");
    });
    it("can set by an object", function() {
      expect(track.get("genra")).to.be.undefined;
      expect(track.get("music")).to.be.undefined;
      track.set({
        genra: "rock",
        music: "shimmer"
      });
      expect(track.get("genra")).to.equal("rock");
      expect(track.get("music")).to.equal("shimmer");
    });
  });

  describe("#unset(key)", function() {
    it("should delete a value stored", function() {
      expect(track.get("name")).to.equal("drums");
      track.unset("name");
      expect(track.get("name")).to.be.undefined;
    });
  });

  describe("#reset", function() {
    it("should reset states of the track", function() {
      track.record("snare", [1,2]);
      track.set("genra", "rock");
      track.muteOn();
      expect(track.tables.length).to.equal(3);
      expect(track.notetable).to.deep.equal([0,1,2]);
      expect(track.muted).to.be.true;

      track.reset();
      expect(track.tables.length).to.equal(0);
      expect(track.notetable).to.deep.equal([]);
      expect(track.muted).to.be.false;
    });
  });

  describe("#which()", function() {
    it("should return names of table recorded with a note", function() {
      expect(track.which(1)).to.deep.equal(["hihat"]);
      track.record("snare", [1,2]);
      expect(track.which(1)).to.deep.equal(["hihat","snare"]);
    });
  });

  describe("#getTableSources()", function() {
    it("should return names of table of source", function() {
      expect(track.getTableSources()).to.deep.equal(["hihat","kick"]);
    });
  });

  describe("#mute(OnOff)", function() {
    it("should switch a state of muting", function() {
      expect(track.muted).to.be.false;
      track.mute();
      expect(track.muted).to.be.true;
      track.mute();
      expect(track.muted).to.be.false;
      track.mute(true);
      expect(track.muted).to.be.true;
      track.mute(false);
      expect(track.muted).to.be.false;
    });
  });

  describe("#muteOn()", function() {
    it("should switch muting to on, alias of #mute(true)", function() {
      expect(track.muted).to.be.false;
      track.muteOn();
      expect(track.muted).to.be.true;
      track.muteOn();
      expect(track.muted).to.be.true;
    });
  });

  describe("#muteOff", function() {
    it("should switch muting to off, alias of #mute(false)", function() {
      track.muteOn();
      expect(track.muted).to.be.true;
      track.muteOff();
      expect(track.muted).to.be.false;
      track.muteOff();
      expect(track.muted).to.be.false;
    });
  });

  describe("#record(source, notes)", function() {
    it("should record notes responded to a source", function() {
      var
        hihat = track.getTable("hihat"),
        kick = track.getTable("kick");

      expect(hihat.notes).to.deep.equal([0,1,2]);
      expect(kick.notes).to.deep.equal([0,2]);
      expect(track.notetable).to.deep.equal([0,1,2]);

      track.record("hihat", [2,3,4]);
      expect(hihat.notes).to.deep.equal([0,1,2,3,4]);
      expect(kick.notes).to.deep.equal([0,2]);
      expect(track.notetable).to.deep.equal([0,1,2,3,4]);

      track.record({
        hihat: [6,7,8],
        kick:  [1,10]
      });
      expect(hihat.notes).to.deep.equal([0,1,2,3,4,6,7,8]);
      expect(kick.notes).to.deep.equal([0,1,2,10]);
      expect(track.notetable).to.deep.equal([0,1,2,3,4,6,7,8,10]);
    });
    it("should throw an error if source isn't setted on belonging to a sequencer", function() {
      expect(function() {
        track.record("unsetted", [1,2,3]);
      }).to.throw(Error);
    });
    it("should throw an error if passed notes are neither a number nor an array of numbers", function() {
      expect(function() {
        track.record("hihat", "notes");
      }).to.throw(TypeError);
    });
  });

  describe("#unrecord(source, notes)", function() {
    if("should delete notes recorded", function() {
      var
      hihat = track.getTable("hihat"),
      kick = track.getTable("kick");

      expect(hihat.notes).to.deep.equal([0,1,2]);
      expect(kick.notes).to.deep.equal([0,2]);
      expect(track.notetable).to.deep.equal([0,1,2]);

      track.unrecord("hihat", [0,1]);
      expect(hihat.notes).to.deep.equal([2]);
      expect(kick.notes).to.deep.equal([0,2]);
      expect(track.notetable).to.deep.equal([0,2]);
    });
  });
});
