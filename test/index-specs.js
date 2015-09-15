// transpile:mocha

import xcode from '..';
import chai from 'chai';

chai.should();

describe('index', () => {
  it('exported objects should exist', () => {
    xcode.should.exist;
  });
});
