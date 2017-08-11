"use strict";

const gulp = require('gulp');
const boilerplate = require('appium-gulp-plugins').boilerplate.use(gulp);

boilerplate({
  build: "Appium Xcode",
  coverage: {
    files: ['./test/**/*-specs.js'],
    verbose: true
  },
});
