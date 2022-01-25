'use strict';

const gulp = require('gulp');
const boilerplate = require('@appium/gulp-plugins').boilerplate.use(gulp);
const DEFAULTS = require('@appium/gulp-plugins').boilerplate.DEFAULTS;

boilerplate({
  build: 'Appium Xcode',
  files: DEFAULTS.files.concat('index.js'),
  coverage: {
    files: ['./build/test/**/*-specs.js', '!./build/test/**/*-e2e-specs.js'],
    verbose: true,
  },
});
