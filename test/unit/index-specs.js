import xcode from '../../lib/index';

describe('index', function () {
  let chai;
  let should;

  before(async function() {
    chai = await import('chai');

    should = chai.should();
  });


  it('exported objects should exist', function () {
    xcode.should.exist;
  });
});
