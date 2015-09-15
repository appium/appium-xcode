// transpile:mocha

import xcode from '../index.js';
import chai from 'chai';

chai.should();

describe('index', () => {
  it('exported objects should exist', () => {
    xcode.should.exist;
  });
});
