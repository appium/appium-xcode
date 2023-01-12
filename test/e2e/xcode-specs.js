import * as xcode from '../../lib/xcode';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { fs, util } from '@appium/support';
import _ from 'lodash';


let should = chai.should();
chai.use(chaiAsPromised);

describe('xcode @skip-linux', function () {
  // on slow machines and busy CI systems these can be slow and flakey
  this.timeout(30000);

  describe('getPath', function () {
    it('should get the path to xcode from xcode-select', async function () {
      const path = await xcode.getPathFromXcodeSelect();
      should.exist(path);
      await fs.exists(path);
    });

    it('should get the path to xcode if provided in DEVELOPER_DIR', async function () {
      process.env.DEVELOPER_DIR = await xcode.getPathFromXcodeSelect();
      try {
        const path = await xcode.getPathFromDeveloperDir();
        should.exist(path);
        await fs.exists(path);
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should fail if the path to xcode provided in DEVELOPER_DIR is wrong', async function () {
      process.env.DEVELOPER_DIR = 'yolo';
      try {
        await xcode.getPathFromDeveloperDir().should.eventually.be.rejected;
      } finally {
        delete process.env.DEVELOPER_DIR;
      }
    });

    it('should get the path to xcode', async function () {
      const path = await xcode.getPath();
      path.should.eql(await xcode.getPathFromXcodeSelect());
    });
  });

  describe('getVersion', function () {
    let versionRE = /\d\.\d\.*\d*/;

    it('should get the version of xcode', async function () {
      let version = await xcode.getVersion();
      should.exist(version);
      _.isString(version).should.be.true;
      versionRE.test(version).should.be.true;
    });

    it('should get the path and version again, these values are cached', async function () {
      await xcode.getPath();
      await xcode.getVersion();

      let before = new Date();
      let path = await xcode.getPath();
      let after = new Date();

      should.exist(path);
      await fs.exists(path);
      (after - before).should.be.at.most(2);

      before = new Date();
      let version = await xcode.getVersion();
      after = new Date();

      should.exist(version);
      _.isString(version).should.be.true;
      versionRE.test(version).should.be.true;
      (after - before).should.be.at.most(2);
    });

    it('should get the parsed version', async function () {
      let nonParsedVersion = await xcode.getVersion();
      let version = await xcode.getVersion(true);
      should.exist(version);
      _.isString(version.versionString).should.be.true;
      version.versionString.should.eql(nonParsedVersion);

      parseFloat(version.versionFloat).should.equal(version.versionFloat);
      parseInt(version.major, 10).should.equal(version.major);
      parseInt(version.minor, 10).should.equal(version.minor);
    });
  });

  it('should get clang version', async function () {
    const cliVersion = await xcode.getClangVersion();
    _.isString(util.coerceVersion(cliVersion, true)).should.be.true;
  });

  it('should get max iOS SDK version', async function () {
    let version = await xcode.getMaxIOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
    (parseFloat(version) - 6.1).should.be.at.least(0);
  });

  it('should get max tvOS SDK version', async function () {
    let version = await xcode.getMaxTVOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
  });
});
