// transpile:mocha

import xcode from '../index';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { fs } from 'appium-support';
import _ from 'lodash';


let should = chai.should();
chai.use(chaiAsPromised);

describe('xcode @skip-linux', function () {
  // on slow machines and busy CI systems these can be slow and flakey
  this.timeout(30000);

  it('should get the path to xcode executable', async function () {
    let path = await xcode.getPath();
    should.exist(path);
    await fs.exists(path);

  });

  describe('getVersion', () => {
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
      (after-before).should.be.at.most(2);

      before = new Date();
      let version = await xcode.getVersion();
      after = new Date();

      should.exist(version);
      _.isString(version).should.be.true;
      versionRE.test(version).should.be.true;
      (after-before).should.be.at.most(2);
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

  it('should get the command line tools version', async () => {
    let cliVersion = await xcode.getCommandLineToolsVersion();
    _.isString(cliVersion).should.be.true;
  });

  it('should clear the cache if asked to', async function () {
    xcode.clearInternalCache();

    let before = new Date();
    await xcode.getPath();
    let after = new Date();
    (after-before).should.be.at.least(6);

  });

  it('should get max iOS SDK version', async () => {
    let version = await xcode.getMaxIOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
    (parseFloat(version)-6.1).should.be.at.least(0);
  });

  it('should get max tvOS SDK version', async () => {
    let version = await xcode.getMaxTVOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
  });

  it('should get a list of devices', async () => {
    let devices = await xcode.getConnectedDevices();
    should.exist(devices);
    (typeof devices).should.equal('object');
  });

  it('should get the path to instruments binary', async () => {
    let instrumentsPath = await xcode.getInstrumentsPath();

    should.exist(instrumentsPath);
    (typeof instrumentsPath).should.equal('string');
    instrumentsPath.length.should.be.above(3);
    await fs.exists(instrumentsPath);
  });

  describe('ui automation', function () {
    before(async function () {
      let version = await xcode.getVersion(true);
      if (version.major >= 8) {
        this.skip();
      }
    });
    it('should find the automation trace template', async () => {
      let path = await xcode.getAutomationTraceTemplatePath();

      should.exist(path);
      await fs.exists(path).should.eventually.be.true;
      let suffix = ".tracetemplate";
      path.slice(-suffix.length).should.equal(suffix);
    });
  });
});
