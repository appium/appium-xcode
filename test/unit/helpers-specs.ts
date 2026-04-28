import {expect} from 'chai';
import {memoize} from '../../lib/helpers';

describe('helpers', function () {
  describe('memoize', function () {
    it('should cache the result for identical arguments', function () {
      let callCount = 0;
      const add = memoize((a: number, b: number) => {
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
      const add = memoize((a: number, b: number) => {
        callCount += 1;
        return a + b;
      });

      const result1 = add(1, 2);
      const result2 = add(2, 3);

      expect(result1).to.equal(3);
      expect(result2).to.equal(5);
      expect(callCount).to.equal(2);
    });

    it('should support BigInt arguments', function () {
      let callCount = 0;
      const multiply = memoize((a: bigint, b: bigint) => {
        callCount += 1;
        return a * b;
      });

      const result1 = multiply(2n, 3n);
      const result2 = multiply(2n, 3n);
      const result3 = multiply(3n, 3n);

      expect(result1).to.equal(6n);
      expect(result2).to.equal(6n);
      expect(result3).to.equal(9n);
      expect(callCount).to.equal(2);
    });

    it('should support circular object arguments', function () {
      let callCount = 0;
      const pickName = memoize((obj: {name: string; self?: unknown}) => {
        callCount += 1;
        return obj.name;
      });

      const circularArg = {name: 'first'} as {name: string; self?: unknown};
      circularArg.self = circularArg;
      const secondCircularArg = {name: 'second'} as {name: string; self?: unknown};
      secondCircularArg.self = secondCircularArg;

      const result1 = pickName(circularArg);
      const result2 = pickName(circularArg);
      const result3 = pickName(secondCircularArg);

      expect(result1).to.equal('first');
      expect(result2).to.equal('first');
      expect(result3).to.equal('second');
      expect(callCount).to.equal(2);
    });
  });
});
