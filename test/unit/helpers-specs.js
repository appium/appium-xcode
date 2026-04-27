import {expect} from 'chai';
import {memoize} from '../../lib/helpers';

describe('helpers', function () {
  describe('memoize', function () {
    it('should cache the result for identical arguments', function () {
      let callCount = 0;
      const add = memoize((a, b) => {
        callCount += 1;
        return a + b;
      });

      const result1 = add(1, 2);
      const result2 = add(1, 2);

      expect(result1).to.equal(3);
      expect(result2).to.equal(3);
      expect(callCount).to.equal(1);
    });

    it('should not reuse cache for different arguments', function () {
      let callCount = 0;
      const add = memoize((a, b) => {
        callCount += 1;
        return a + b;
      });

      const result1 = add(1, 2);
      const result2 = add(2, 3);

      expect(result1).to.equal(3);
      expect(result2).to.equal(5);
      expect(callCount).to.equal(2);
    });
  });
});
