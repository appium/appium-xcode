import {fs, util} from '@appium/support';
import assert from 'node:assert/strict';
import * as xcode from '../../lib/xcode';
import {describe, it} from 'node:test';

// on slow machines and busy CI systems these can be slow and flakey
describe('xcode', {timeout: 30000}, function () {
  describe('getPath', function () {
    it('should get the path to xcode from xcode-select', async function () {
      const xcodePath = await xcode.getPathFromXcodeSelect();
      assert.ok(xcodePath);
      await fs.exists(xcodePath);
    });

    it('should get the path to xcode if provided in DEVELOPER_DIR', async function () {
      process.env.DEVELOPER_DIR = await xcode.getPathFromXcodeSelect();
      try {
        const xcodePath = await xcode.getPathFromDeveloperDir();
        assert.ok(xcodePath);
        await fs.exists(xcodePath);
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should fail if the path to xcode provided in DEVELOPER_DIR is wrong', async function () {
      process.env.DEVELOPER_DIR = 'yolo';
      try {
        await assert.rejects(() => xcode.getPathFromDeveloperDir());
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should get the path to xcode', async function () {
      const xcodePath = await xcode.getPath();
      assert.strictEqual(xcodePath, await xcode.getPathFromXcodeSelect());
    });
  });

  describe('getVersion', function () {
    const versionRE = /\d\.\d\.*\d*/;

    it('should get the version of xcode', async function () {
      const version = await xcode.getVersion(false);
      assert.ok(version);
      assert.strictEqual(typeof version, 'string');
      assert.ok(versionRE.test(version));
    });

    it('should get the path and version again, these values are cached', async function () {
      await xcode.getPath();
      await xcode.getVersion(false);

      let before = Number(new Date());
      const xcodePath = await xcode.getPath();
      let after = Number(new Date());

      assert.ok(xcodePath);
      await fs.exists(xcodePath);
      assert.ok(after - before <= 2);

      before = Number(new Date());
      const version = await xcode.getVersion(false);
      after = Number(new Date());

      assert.ok(version);
      assert.strictEqual(typeof version, 'string');
      assert.ok(versionRE.test(version));
      assert.ok(after - before <= 2);
    });

    it('should get the parsed version', async function () {
      const nonParsedVersion = await xcode.getVersion(false);
      const version = await xcode.getVersion(true);
      assert.ok(version);
      assert.strictEqual(typeof version.versionString, 'string');
      assert.strictEqual(version.versionString, nonParsedVersion);

      assert.strictEqual(parseFloat(String(version.versionFloat)), version.versionFloat);
      assert.strictEqual(parseInt(String(version.major), 10), version.major);
      assert.strictEqual(parseInt(String(version.minor), 10), version.minor);
    });
  });

  it('should get clang version', async function () {
    const cliVersion = await xcode.getClangVersion();
    assert.ok(cliVersion);
    assert.strictEqual(typeof util.coerceVersion(cliVersion!, true), 'string');
  });

  it('should get max iOS SDK version', async function () {
    const version = await xcode.getMaxIOSSDK();

    assert.ok(version);
    assert.strictEqual(typeof version, 'string');
    assert.ok(parseFloat(String(version)) - 6.1 >= 0);
  });

  it('should get max tvOS SDK version', async function () {
    const version = await xcode.getMaxTVOSSDK();

    assert.ok(version);
    assert.strictEqual(typeof version, 'string');
  });
});
