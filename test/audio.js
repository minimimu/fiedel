"use strict";

describe("fiedel.Audio", function() {
  var
    ctx, xhr,
    url = "../sounds/sinon",
    duration = 0.25,
    ctx = null,
    Audio = null,
    audio = null,
    request = null;

  // ctx = new AudioContext();
  // fiedel.use(ctx);
  // Audio = fiedel.Audio;

  xhr = sinon.useFakeXMLHttpRequest();
  xhr.prototype.response = new ArrayBuffer();
  xhr.onCreate = function(xhr) {
    return request = xhr;
  };

  beforeEach(function(done) {
    ctx = new AudioContext();
    fiedel.use(ctx);
    Audio = fiedel.Audio;
    audio = new Audio();
    audio.load(url).then(function() {
      var buffer;
      buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      audio.buffer = buffer;
      audio.duration = audio.length = buffer.duration;
      done();
    });
    request.respond(200);
  });

  describe("new", function() {
    it("should return an instance of fiedel.Audio", function() {
      expect(audio).to.be.an.instanceof(fiedel.Audio);
    });
    it("should have GainNode connected to AudioDestinationNode", function() {
      ctx.$reset();
      expect(ctx.toJSON()).to.deep.equal({
        name: "AudioDestinationNode",
        inputs: []
      });
      new Audio;
      expect(ctx.toJSON()).to.deep.equal({
        name: "AudioDestinationNode",
        inputs: [
          {
            name: "GainNode",
            gain: {
              value: 1,
              inputs: []
            },
            inputs: []
          }
        ]
      });
    });
  });

  describe(".load(url)", function() {
    it("should load an audio source and then create an instance of fiedel.Audio", function(done) {
      Audio.load(url).then(function(audio) {
        expect(audio).to.be.an.instanceof(Audio);
        expect(audio.buffer).to.be.an.instanceof(AudioBuffer);
        done();
      });
      request.respond(200);
    });
  });

  describe("#load(url)", function() {
    it("should load an audio source and then assign a buffer object to `buffer` property", function(done) {
      audio = new Audio;
      expect(audio.buffer).to.be.null;
      audio.load(url).then(function(a) {
        expect(audio).to.equal(a);
        expect(audio.buffer).to.be.an.instanceof(AudioBuffer);
        done();
      });
      request.respond(200);
    });
  });

  describe("#isPlaying", function() {
    it("should work as expected", function() {
      expect(audio.isPlaying).to.be.false;

      audio.play();
      expect(audio.isPlaying).to.be.true;

      ctx.$processTo("00:00.150");
      expect(audio.isPlaying).to.be.true;

      ctx.$processTo("00:00.300");
      expect(audio.isPlaying).to.be.false;
    });
  });

  describe("#connect(connections)", function() {
    it("should generate audio paragraphs", function() {
      audio.connect(ctx.createAnalyser());
      expect(ctx.toJSON()).to.deep.equal({
        name: "AudioDestinationNode",
        inputs: [
          {
            name: "GainNode",
            gain: {
              value: 1,
              inputs: []
            },
            inputs: [
              {
                name: "AnalyserNode",
                fftSize: 2048,
                minDecibels: -100,
                maxDecibels: 30,
                smoothingTimeConstant: 0.8,
                inputs: []
              }
            ]
          }
        ]
      });
    });
  });

  describe("#play(offset, length)", function() {
    it("should play immediately", function() {
      expect(audio.isPlaying).to.be.false;
      audio.play();
      expect(audio.isPlaying).to.be.true;
    });
    it("should end in the specified time subtracted `offset` from `length`", function() {
      var callback = sinon.spy();
      audio.on("end", callback);

      audio.play(0.1, 0.2);
      expect(audio.isPlaying, "00:00.000").to.be.true;
      expect(callback.called, "00:00.000").to.be.false;

      ctx.$processTo("00:00.075");
      expect(audio.isPlaying, "00:00.075").to.be.true;
      expect(callback.called, "00:00.075").to.be.false;

      ctx.$processTo("00:00.110");
      expect(audio.isPlaying, "00:00.110").to.be.false;
      expect(callback.called, "00:00.110").to.be.true;
    });
  });

  describe("#book(when, offset, length)", function() {
    it("should play when the currentTime reach the specified time", function() {
      var
        clock = sinon.useFakeTimers(),
        callback = sinon.spy();
      audio.on("play", callback);

      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      audio.book(0.25);
      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      clock.tick(250);
      expect(audio.isPlaying).to.be.true;
      expect(callback.called).to.be.true;

      clock.restore();
    });
  });

  describe("#stop(when)", function() {
    it("should stop in the specified time", function() {
      expect(audio.isPlaying).to.be.false;

      audio.play();
      expect(audio.isPlaying).to.be.true;

      audio.stop(0.2);
      expect(audio.isPlaying).to.be.true;

      ctx.$processTo("00:00.210");
      expect(audio.isPlaying).to.be.false;
    });
    it("should stop immediately when an argument is less than 0", function() {
      audio.play();
      expect(audio.isPlaying).to.be.true;

      audio.stop(0);
      ctx.$process(1);
      expect(audio.isPlaying).to.be.false;

      audio.play();
      expect(audio.isPlaying).to.be.true;

      audio.stop(-1);
      ctx.$process(1);
      expect(audio.isPlaying).to.be.false;
    });
  });

  describe("#cancel(ids)", function() {
    it("should cancel the booked audio corresponded to a given id", function() {
      var
        clock = sinon.useFakeTimers(),
        callback = sinon.spy(),
        bookingId1 = audio.book(1),
        bookingId2 = audio.book(2),
        bookingId3 = audio.book(3);
      audio.on("play", callback);

      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      audio.cancel([bookingId1, bookingId3]);

      clock.tick(1500);
      ctx.$processTo("00:01.500");
      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      clock.tick(500);
      ctx.$processTo("00:02.000");
      expect(audio.isPlaying).to.be.true;
      expect(callback.calledOnce).to.be.true;

      clock.tick(1100);
      ctx.$processTo("00:03.100");
      expect(audio.isPlaying).to.be.false;
      expect(callback.calledOnce).to.be.true;

      clock.restore();
    });
    it("should cancel all of booking audios when no argument passed", function() {
      var
        clock = sinon.useFakeTimers(),
        callback = sinon.spy(),
        bookingId1 = audio.book(1),
        bookingId2 = audio.book(2),
        bookingId3 = audio.book(3);
      audio.on("play", callback);

      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      audio.cancel();

      clock.tick(1500);
      ctx.$processTo("00:01.500");
      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      clock.tick(500);
      ctx.$processTo("00:02.000");
      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      clock.tick(1100);
      ctx.$processTo("00:03.100");
      expect(audio.isPlaying).to.be.false;
      expect(callback.called).to.be.false;

      clock.restore();
    });
  });

  describe("#destory()", function() {
    it("should prepare to be collected by garbage collector", function() {
      expect(audio.buffer).to.be.an.instanceof(AudioBuffer);
      audio.destroy();
      expect(audio.buffer).to.be.null;
      expect(audio._booking).to.deep.equal({});
    });
  });

  describe("#on(", function() {

    describe("'play', callback)", function() {
      it("should be triggered when an audio is played", function() {
        var callback = sinon.spy();
        audio.on("play", callback);

        expect(audio.isPlaying).to.be.false;
        expect(callback.called).to.be.false;

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(callback.called).to.be.true;
      });
    });

    describe("'abort', callback)", function() {
      it("should be triggered when an audio is aborted", function() {
        var callback = sinon.spy();
        audio.on("abort", callback);

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(callback.called).to.be.false;

        ctx.$processTo("00:00.300");
        expect(audio.isPlaying).to.be.false;
        expect(callback.called).to.be.false;

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(callback.called).to.be.false;

        audio.play();
        ctx.$processTo("00:00.310");
        expect(audio.isPlaying).to.be.true;
        expect(callback.called).to.be.true;
      });
    });

    describe("'cancel', callback", function() {
      it("should be triggered when a booking audio is canceld", function() {
        var callback = sinon.spy();
        audio.on("cancel", callback);

        expect(callback.called).to.be.false;

        audio.book(2);
        expect(callback.called).to.be.false;

        audio.cancel();
        expect(callback.called).to.be.true;
      });
    });

    describe("'stop', callback)", function() {
      it("should be triggered only when an audio is stoped", function() {
        var
          endCallback = sinon.spy(),
          stopCallback = sinon.spy(),
          loopCallback = sinon.spy();
        audio.on("end", endCallback);
        audio.on("stop", stopCallback);
        audio.on("loop", loopCallback);

        expect(audio.isPlaying).to.be.false;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        audio.stop();
        ctx.$process(1);
        expect(audio.isPlaying).to.be.false;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.true;
        expect(loopCallback.called).to.be.false;
      });
    });

    describe("'end', callback)", function() {
      it("should be triggered only when the currentTime reach the duration", function() {
        var
          endCallback = sinon.spy(),
          stopCallback = sinon.spy(),
          loopCallback = sinon.spy();
        audio.on("end", endCallback);
        audio.on("stop", stopCallback);
        audio.on("loop", loopCallback);

        expect(audio.isPlaying).to.be.false;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        ctx.$processTo("00:00.300");
        expect(audio.isPlaying).to.be.false;
        expect(endCallback.called).to.be.true;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;
      });
    });

    describe("'loop', callback)", function() {
      it("should be triggered when an audio is looped", function() {
        var
          endCallback = sinon.spy(),
          stopCallback = sinon.spy(),
          loopCallback = sinon.spy();
        audio.on("end", endCallback);
        audio.on("stop", stopCallback);
        audio.on("loop", loopCallback);

        audio.loop = true;
        expect(audio.isPlaying).to.be.false;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        audio.play();
        expect(audio.isPlaying).to.be.true;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.false;

        ctx.$processTo("00:00.300");
        expect(audio.isPlaying).to.be.true;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.called).to.be.true;

        ctx.$processTo("00:00.600");
        expect(audio.isPlaying).to.be.true;
        expect(endCallback.called).to.be.false;
        expect(stopCallback.called).to.be.false;
        expect(loopCallback.calledTwice).to.be.true;
      });
    });
  });

});
