import * as xcode from '../../lib/xcode';
import { fs, util } from '@appium/support';
import _ from 'lodash';


describe('xcode @skip-linux', function () {
  // on slow machines and busy CI systems these can be slow and flakey
  this.timeout(30000);

  let chai;
  let chaiAsPromised;
  let should;

  before(async function() {
    chai = await import('chai');
    chaiAsPromised = await import('chai-as-promised');

    should = chai.should();
    chai.use(chaiAsPromised.default);
  });

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
      let version = /** @type {string} */(await xcode.getVersion());
      should.exist(version);
      _.isString(version).should.be.true;
      versionRE.test(version).should.be.true;
    });

    it('should get the path and version again, these values are cached', async function () {
      await xcode.getPath();
      await xcode.getVersion();

      let before = Number(new Date());
      let path = await xcode.getPath();
      let after = Number(new Date());

      should.exist(path);
      await fs.exists(path);
      (after - before).should.be.at.most(2);

      before = Number(new Date());
      let version = /** @type {string} */(await xcode.getVersion());
      after = Number(new Date());

      should.exist(version);
      _.isString(version).should.be.true;
      versionRE.test(version).should.be.true;
      (after - before).should.be.at.most(2);
    });

    it('should get the parsed version', async function () {
      let nonParsedVersion = await xcode.getVersion();
      let version = /** @type {import('../../lib/xcode').XcodeVersion} */(await xcode.getVersion(true));
      should.exist(version);
      _.isString(version.versionString).should.be.true;
      version.versionString.should.eql(nonParsedVersion);

      parseFloat(String(version.versionFloat)).should.equal(version.versionFloat);
      parseInt(String(version.major), 10).should.equal(version.major);
      parseInt(String(version.minor), 10).should.equal(version.minor);
    });
  });

  it('should get clang version', async function () {
    const cliVersion = await xcode.getClangVersion();
    _.isString(util.coerceVersion(/** @type {string} */(cliVersion), true)).should.be.true;
  });

  it('should get max iOS SDK version', async function () {
    let version = await xcode.getMaxIOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
    (parseFloat(String(version)) - 6.1).should.be.at.least(0);
  });

  it('should get max tvOS SDK version', async function () {
    let version = await xcode.getMaxTVOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
  });
});
