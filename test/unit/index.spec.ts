import assert from 'node:assert/strict';
import xcode from '../../lib/index';
import {describe, it} from 'node:test';

describe('index', function () {
  it('exported objects should exist', function () {
    assert.ok(xcode);
  });
});
