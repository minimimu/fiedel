"use strict";

describe("fiedel.Sequencer", function() {
  var ctx, sequencer, drums, tone, source;

  beforeEach(function() {
    source = sinon.spy();
    ctx = new AudioContext;
    fiedel.use(ctx);
    sequencer = new fiedel.Sequencer({
      bpm:  60,
      note: 4,
      loop: false
    });
    sequencer.preset({
      hihat: source,
      snare: source,
      kick:  source,
      sine:  source,
      wave:  source,
    });
    drums = sequencer.createTrack({
      attributes: {
        name:  "drums",
        genra: "pop"
      }
    });
    tone = sequencer.createTrack({
      attributes: {
        name:  "tone",
        genra: "pop"
      }
    });
    drums.record({
      hihat: [0,1,2],
      kick:  [0,2]
    });
    tone.record({
      sine: [3,5],
      wave: [1,2]
    });
  });

  describe("#load(urlMap, options)", function() {
    it("should load an audio and create an instance of fiedel.Audio, then stores those as sources", function(done) {
      var
        a, b,
        xhr = sinon.useFakeXMLHttpRequest(),
        requests = [],
        urlMap = {
          base: "../sounds/",
          ext:  ".wav",
          urls: [
            "a",
            "b alias"
          ]
        },
        options = {
          volume: 0.5
        };

      xhr.prototype.response = new ArrayBuffer();
      xhr.onCreate = function(xhr) {
        requests.push(xhr);
      };

      sequencer = new fiedel.Sequencer();
      sequencer.load(urlMap, options).then(function(result) {
        a = result.audios[0], b = result.audios[1];
        expect(a).to.be.an.instanceof(fiedel.Audio);
        expect(a.volume).to.equal(0.5);
        expect(b).to.be.an.instanceof(fiedel.Audio);
        expect(b.volume).to.equal(0.5);
        expect(sequencer.sourceMap).to.deep.equal({
          a: a,
          alias: b
        });
        done();
      });

      requests.forEach(function(request) {
        request.respond(200);
      });
    });
  });

  describe("#start()", function() {
    it("should start to sequence and play back an audio in the precise time", function() {
      var
        clock = sinon.useFakeTimers(),
        callback = sinon.spy();
      sequencer.on("start", callback);

      expect(sequencer.isPlaying).to.be.false;
      expect(callback.called).to.be.false;
      expect(source.called).to.be.false;

      sequencer.start();
      expect(sequencer.isPlaying).to.be.true;
      expect(callback.called).to.be.true;
      expect(source.callCount).to.equal(2);
      expect(source.calledWith(0)).to.be.true;

      ctx.$processTo("00:01.000");
      clock.tick(1000);
      expect(sequencer.isPlaying).to.be.true;
      expect(source.callCount).to.equal(4);
      expect(source.calledWith(1)).to.be.true;

      ctx.$processTo("00:02.000");
      clock.tick(1000);
      expect(sequencer.isPlaying).to.be.true;
      expect(source.callCount).to.equal(7);
      expect(source.calledWith(2)).to.be.true;

      ctx.$processTo("00:03.000");
      clock.tick(1000);
      expect(sequencer.isPlaying).to.be.true;
      expect(source.callCount).to.equal(8);
      expect(source.calledWith(3)).to.be.true;

      ctx.$processTo("00:04.000");
      clock.tick(1000);
      expect(sequencer.isPlaying).to.be.true;
      expect(source.callCount).to.equal(8);
      expect(source.calledWith(3)).to.be.true;

      ctx.$processTo("00:05.000");
      clock.tick(1000);
      expect(sequencer.isPlaying).to.be.true;
      expect(source.callCount).to.equal(9);
      expect(source.calledWith(5)).to.be.true;

      sequencer.stop();
      clock.restore();
    });
    it("should not duplicate to start while scheduling is starting", function() {
      var callback = sinon.spy();
      sequencer.on("start", callback);

      sequencer.start();
      expect(callback.callCount).to.equal(1);

      sequencer.start();
      expect(callback.callCount).to.equal(1);
    });
  });

  describe("#stop()", function() {
    it("should stop scheduling the program", function() {
      var callback = sinon.spy();
      sequencer.on("stop", callback);

      sequencer.stop();
      expect(callback.called).to.be.false;

      sequencer.start();
      sequencer.stop();
      expect(callback.called).to.be.true;
    });
  });

  describe("#getTrackIds()", function() {
    it("should return ids of track", function() {
      expect(sequencer.getTrackIds()).to.deep.equal([drums.id, tone.id]);
    });
  });

  describe("#getSourceNames()", function() {
    it("should return names of setted source", function() {
      expect(sequencer.getSourceNames()).to.deep.equal([
        "hihat",
        "snare",
        "kick",
        "sine",
        "wave"
      ]);
    });
  });

  describe("#get(id)", function() {
    it("should return a track by the id", function() {
      expect(sequencer.get(drums.id + tone.id)).to.be.an.undefined;
      expect(sequencer.get(drums.id)).to.equal(drums);
      expect(sequencer.get(tone.id)).to.equal(tone);
    });
  });

  describe("#find(query)", function() {
    it("should return tracks that matched to given query", function() {
      expect(sequencer.find({
        name: "drums"
      })).to.deep.equal([drums]);

      expect(sequencer.find(function(attrs) {
        return attrs["name"] === "tone";
      })).to.deep.equal([tone]);

      expect(sequencer.find({
        genra: "pop"
      })).to.deep.equal([drums, tone]);

      expect(sequencer.find({
        name:  "drums",
        genra: "rock"
      })).to.deep.equal([]);
    });
  });

  describe("#which(note)", function() {
    it("should return ids of track that has recorded to the note", function() {
      expect(sequencer.which(1)).to.deep.equal([drums.id, tone.id]);
      expect(sequencer.which(3)).to.deep.equal([tone.id]);
      expect(sequencer.which(8)).to.be.an.undefined;
    });
  });

  describe("#getMuting()", function() {
    it("should return ids of track muting on", function() {
      expect(sequencer.getMuting()).to.deep.equal([]);
      sequencer.mute();
      expect(sequencer.getMuting()).to.deep.equal([drums.id, tone.id]);
      sequencer.mute();
      expect(sequencer.getMuting()).to.deep.equal([]);
    });
  });

  describe("#isMuted(trackId)", function() {
    it("should return boolean whether the track is muted", function() {
      expect(sequencer.isMuted(drums.id)).to.be.false;
      sequencer.mute(drums.id);
      expect(sequencer.isMuted(drums.id)).to.be.true;
    });
  });

  describe("#muteOn(tracks)", function() {
    it("should mute tracks on, alias of #mute(tracks, true)", function() {
      expect(sequencer.getMuting()).to.deep.equal([]);
      sequencer.muteOn(drums.id);
      expect(sequencer.getMuting()).to.deep.equal([drums.id]);
      sequencer.muteOn();
      expect(sequencer.getMuting()).to.deep.equal([drums.id, tone.id]);
    });
  });

  describe("#muteOff(tracks)", function() {
    it("should mute tracks off, alias of #mute(tracks, false)", function() {
      sequencer.muteOn()
      expect(sequencer.getMuting()).to.deep.equal([drums.id, tone.id]);
      sequencer.muteOff(drums.id);
      expect(sequencer.getMuting()).to.deep.equal([tone.id]);
      sequencer.muteOff();
      expect(sequencer.getMuting()).to.deep.equal([]);
    });
  });

  describe("#mute(tracks, OnOff)", function() {
    it("can toggle to mute on and off", function() {
      expect(sequencer.getMuting()).to.deep.equal([]);
      sequencer.mute();
      expect(sequencer.getMuting()).to.deep.equal([drums.id, tone.id]);
      sequencer.mute(drums.id);
      expect(sequencer.getMuting()).to.deep.equal([tone.id]);
      sequencer.mute();
      expect(sequencer.getMuting()).to.deep.equal([drums.id]);
    });
  });

  describe("#preset(name, source, options)", function() {
    it("should set and store the given source", function() {
      var source = function(){};
      sequencer = new fiedel.Sequencer();
      expect(sequencer.getSourceNames()).to.deep.equal([]);
      expect(sequencer.sourceMap).to.deep.equal({});

      sequencer.preset("hihat", source);
      sequencer.preset({
        snare: source,
        kick:  source
      });
      expect(sequencer.getSourceNames()).to.deep.equal(["hihat","snare","kick"]);
      expect(sequencer.sourceMap).to.deep.equal({
        hihat: source,
        snare: source,
        kick:  source
      });
    });
    it("should throw Error if given name what you want to set have been setted", function() {
      expect(sequencer.sourceMap["hihat"]).to.exist;
      expect(function() {
        sequencer.preset("hihat", function(){});
      }).to.throw();
    });
    it("can set even if given name have been setted when options include `override` as true", function() {
      var source = function(){};
      expect(sequencer.sourceMap["hihat"]).to.not.equal(source);
      expect(function() {
        sequencer.preset("hihat", source, {override: true});
      }).to.not.throw();
      expect(sequencer.sourceMap["hihat"]).to.equal(source);
    });
  });

  describe("#unset(name)", function() {
    it("should delete a source from sourceMap and remove notes that related to recorded tables", function() {
      expect(sequencer.sourceMap["hihat"]).to.exist;
      expect(drums.notetable).to.include(1);

      sequencer.unset("hihat");
      expect(drums.notetable).to.not.include(1);
    });
  });

  describe("#createTrack(generator)", function() {
    it("should create a new track", function() {
      var track;
      expect(sequencer.find({name: "newone"})).to.deep.equal([]);
      track = sequencer.createTrack({
        attributes: {
          name: "newone"
        }
      });
      expect(sequencer.find({name: "newone"})).to.deep.equal([track]);
      expect(sequencer.get(track.id)).to.equal(track);
    });
  });

  describe("#remove(tracks)", function() {
    it("should remove tracks and references", function() {
      expect(sequencer.tracks).to.deep.equal([drums, tone]);
      expect(sequencer.notetable).to.include(3);
      expect(tone).to.include.keys("sequencer");

      sequencer.remove(tone);
      expect(sequencer.tracks).to.deep.equal([drums]);
      expect(sequencer.notetable).to.not.include(3);
      expect(tone).to.not.include.keys("sequencer");
    });
  });
});
