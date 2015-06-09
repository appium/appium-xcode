// transpile:mocha

import * as xcode from '../lib/xcode';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import fs from 'fs';
import denodeify from 'denodeify';
import _ from 'lodash';

let should = chai.should();
chai.use(chaiAsPromised);

let fileExists = denodeify(fs.stat);

describe('xcode @skip-linux', () => {

  it('should get the path to xcode executable', async function () {

    let path = await xcode.getPath();
    should.exist(path);
    await fileExists(path);

  });

  it('should get the version of xcode', async function () {

    let version = await xcode.getVersion();
    should.exist(version);
    _.isString(version).should.be.true;
    /\d\.\d\.*\d*/.test(version).should.be.true;
  });

  it('should get the path and version again, these values are cached', async function () {

    await xcode.getPath();
    await xcode.getVersion();

    let before = new Date();
    let path = await xcode.getPath();
    let after = new Date();

    should.exist(path);
    await fileExists(path);
    (after-before).should.be.at.most(2);

    before = new Date();
    let version = await xcode.getVersion();
    after = new Date();

    should.exist(version);
    _.isString(version).should.be.true;
    /\d\.\d\.*\d*/.test(version).should.be.true;
    (after-before).should.be.at.most(2);

  });

  it('should clear the cache if asked to', async function () {

    xcode.clearInternalCache();

    let before = new Date();
    await xcode.getPath();
    let after = new Date();
    (after-before).should.be.at.least(7);

  });

  it('should find the automation trace template', async () => {
    let path = await xcode.getAutomationTraceTemplatePath();

    should.exist(path);
    fileExists(path).should.eventually.be.true;
    let suffix = ".tracetemplate";
    path.slice(-suffix.length).should.equal(suffix);
  });

  it('should get max iOS SDK version', async() => {
    let version = await xcode.getMaxIOSSDK();

    should.exist(version);
    (typeof version).should.equal('string');
    (parseFloat(version)-6.1).should.be.at.least(0);
  });

  it('should get a list of iOS devices', async() => {
    let devices = await xcode.getConnectedDevices();
    should.exist(devices);
    (typeof devices).should.equal('object');
  });

  it('should get the path to instruments binary', async() => {
    let instrumentsPath = await xcode.getInstrumentsPath();

    should.exist(instrumentsPath);
    (typeof instrumentsPath).should.equal('string');
    instrumentsPath.length.should.be.above(3);
    await fileExists(instrumentsPath);
  });
});
