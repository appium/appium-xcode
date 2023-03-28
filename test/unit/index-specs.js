import xcode from '../../lib/index';
import chai from 'chai';

chai.should();

describe('index', function () {
  it('exported objects should exist', function () {
    xcode.should.exist;
  });
});
