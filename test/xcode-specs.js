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

  it('should find the automation trace template', async () => {
    let path = await xcode.getAutomationTraceTemplatePath();

    should.exist(path);
    fileExists(path).should.eventually.be.true;
    let suffix = ".tracetemplate";
    path.slice(-suffix.length).should.equal(suffix);
  });
  
});
