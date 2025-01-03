import xcode from '../../lib/index';

describe('index', function () {
  let chai;

  before(async function() {
    chai = await import('chai');
    chai.should();
  });


  it('exported objects should exist', function () {
    xcode.should.exist;
  });
});
