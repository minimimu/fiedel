"use strict";

describe("fiedel.Loader", function() {
  describe("new" , function() {
    it("should load audio sources", function(done) {
      var
        a, b, audios, byUrl,
        xhr = sinon.useFakeXMLHttpRequest(),
        requests = [],
        urlMap = {
          base: "../sounds/",
          ext:  ".wav",
          urls: [
            "a",
            "b"
          ]
        },
        options = {
          volume: 0.5
        };
      fiedel.use(new AudioContext);
      xhr.prototype.response = new ArrayBuffer();
      xhr.onCreate = function(xhr) {
        requests.push(xhr);
      };

      new fiedel.Loader(urlMap, options).then(function(result) {
        audios = result.audios, byUrl = result.byUrl;
        a = audios[0], b = audios[1];
        expect(audios.length).to.equal(2);
        expect(a).to.be.an.instanceof(fiedel.Audio);
        expect(a.volume).to.equal(0.5);
        expect(b).to.be.an.instanceof(fiedel.Audio);
        expect(b.volume).to.equal(0.5);
        expect(byUrl[a.url]).to.equal(a);
        expect(byUrl[b.url]).to.equal(b);
        done();
      });

      requests.forEach(function(request) {
        request.respond(200);
      });
    });
  });
});
