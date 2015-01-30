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
