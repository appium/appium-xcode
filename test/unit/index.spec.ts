import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import xcode from '../../lib/index.js';

describe('index', function () {
  it('exported objects should exist', function () {
    assert.ok(xcode);
  });
});
