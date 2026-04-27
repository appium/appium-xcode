import {expect} from 'chai';
import xcode from '../../lib/index';

describe('index', function () {
  it('exported objects should exist', function () {
    expect(xcode).to.exist;
  });
});
