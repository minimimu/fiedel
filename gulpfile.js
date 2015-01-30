"use strict";

var
  gulp = require("gulp"),
  connect = require("gulp-connect"),
  browserify = require("browserify"),
  source = require("vinyl-source-stream");

gulp.task("build", function() {
  browserify({ entries: ["./src/fiedel.js"] })
  .bundle()
  .pipe(source("fiedel.js"))
  .pipe(gulp.dest("./"));
});

gulp.task("watch", ["build"], function() {
  gulp.watch("./src/**/*.js", ["build"]);
});

gulp.task("connect", function() {
  connect.server({ port: 3236 });
});

gulp.task("server", ["connect", "watch"]);
