// transpile:mocha

import xcode from '..';
import chai from 'chai';
import 'mochawait';

chai.should();

describe('index', () => {
  it('exported objects should exist', () => {
    xcode.should.exist;
  });
});
