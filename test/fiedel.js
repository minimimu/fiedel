"use strict";

describe("fiedel", function() {

  describe(".use(context)", function() {
    it("should throw an Error object when an argument is not AudioContext", function() {
      expect(function() {
        fiedel.use();
      }).to.throw(Error);
    });
    it("should not throw when audio context is passed", function() {
      expect(function() {
        fiedel.use(new AudioContext);
      }).to.not.throw();
    });
  });

});
