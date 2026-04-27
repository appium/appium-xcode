import {fs, util} from '@appium/support';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as xcode from '../../lib/xcode';

use(chaiAsPromised);

describe('xcode @skip-linux', function () {
  // on slow machines and busy CI systems these can be slow and flakey
  this.timeout(30000);

  describe('getPath', function () {
    it('should get the path to xcode from xcode-select', async function () {
      const xcodePath = await xcode.getPathFromXcodeSelect();
      expect(xcodePath).to.exist;
      await fs.exists(xcodePath);
    });

    it('should get the path to xcode if provided in DEVELOPER_DIR', async function () {
      process.env.DEVELOPER_DIR = await xcode.getPathFromXcodeSelect();
      try {
        const xcodePath = await xcode.getPathFromDeveloperDir();
        expect(xcodePath).to.exist;
        await fs.exists(xcodePath);
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should fail if the path to xcode provided in DEVELOPER_DIR is wrong', async function () {
      process.env.DEVELOPER_DIR = 'yolo';
      try {
        await expect(xcode.getPathFromDeveloperDir()).to.be.rejected;
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should get the path to xcode', async function () {
      const xcodePath = await xcode.getPath();
      expect(xcodePath).to.eql(await xcode.getPathFromXcodeSelect());
    });
  });

  describe('getVersion', function () {
    const versionRE = /\d\.\d\.*\d*/;

    it('should get the version of xcode', async function () {
      const version = await xcode.getVersion(false);
      expect(version).to.exist;
      expect(version).to.be.a('string');
      expect(versionRE.test(version)).to.be.true;
    });

    it('should get the path and version again, these values are cached', async function () {
      await xcode.getPath();
      await xcode.getVersion(false);

      let before = Number(new Date());
      const xcodePath = await xcode.getPath();
      let after = Number(new Date());

      expect(xcodePath).to.exist;
      await fs.exists(xcodePath);
      expect(after - before).to.be.at.most(2);

      before = Number(new Date());
      const version = await xcode.getVersion(false);
      after = Number(new Date());

      expect(version).to.exist;
      expect(version).to.be.a('string');
      expect(versionRE.test(version)).to.be.true;
      expect(after - before).to.be.at.most(2);
    });

    it('should get the parsed version', async function () {
      const nonParsedVersion = await xcode.getVersion(false);
      const version = await xcode.getVersion(true);
      expect(version).to.exist;
      expect(version.versionString).to.be.a('string');
      expect(version.versionString).to.eql(nonParsedVersion);

      expect(parseFloat(String(version.versionFloat))).to.equal(version.versionFloat);
      expect(parseInt(String(version.major), 10)).to.equal(version.major);
      expect(parseInt(String(version.minor), 10)).to.equal(version.minor);
    });
  });

  it('should get clang version', async function () {
    const cliVersion = await xcode.getClangVersion();
    expect(cliVersion).to.exist;
    expect(util.coerceVersion(cliVersion!, true)).to.be.a('string');
  });

  it('should get max iOS SDK version', async function () {
    const version = await xcode.getMaxIOSSDK();

    expect(version).to.exist;
    expect(version).to.be.a('string');
    expect(parseFloat(String(version)) - 6.1).to.be.at.least(0);
  });

  it('should get max tvOS SDK version', async function () {
    const version = await xcode.getMaxTVOSSDK();

    expect(version).to.exist;
    expect(version).to.be.a('string');
  });
});
