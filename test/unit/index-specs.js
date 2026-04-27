import xcode from '../../lib/index';
import {expect} from 'chai';

describe('index', function () {
  it('exported objects should exist', function () {
    expect(xcode).to.exist;
  });
});
