import npmlog from 'npmlog';
import support from 'appium-support';
import fs from 'fs';
import denodeify from 'denodeify';
import path from 'path';

let exec = support.core.exec;
let fileExists = support.util.fileExists;
let readLink = fs.readlink;
let util = support.util;
let env = process.env;

let XCODE_SELECT_TIMEOUT = 3000;
let XCODE_SUBDIR = "/Contents/Developer";

let log = process.env.GLOBAL_NPMLOG ? global.log : npmlog;

let readSymlink = denodeify(readLink);

function _hasExpectedSubDir (path) {
  return path.substring(path.length - XCODE_SUBDIR.length) === XCODE_SUBDIR;
}

async function _getPathFromSymlink (failMessage) {
  // Node's invocation of xcode-select sometimes flakes and returns an empty string.
  // Not clear why. As a workaround, Appium can reliably deduce the version in use by checking
  // the locations xcode-select uses to store the selected version's path. This should be 100%
  // reliable so long as the link locations remain the same. However, since we're relying on
  // hardcoded paths, this approach will break the next time Apple changes the symlink location.
  log.warn(`Finding XcodePath by symlink because ${failMessage}`);

  let symlinkPath = "/var/db/xcode_select_link";
  let legacySymlinkPath = "/usr/share/xcode-select/xcode_dir_path"; //  Xcode < 5.x (?)

  // xcode-select allows users to override its settings with the DEVELOPER_DIR env var,
  // so check that first
  if (util.hasContent(env.DEVELOPER_DIR)) {
    let dir = _hasExpectedSubDir(env.DEVELOPER_DIR) ? env.DEVELOPER_DIR : env.DEVELOPER_DIR + XCODE_SUBDIR;
    return dir;
  }

  if (await fileExists(symlinkPath)) {
    return readSymlink(symlinkPath);
  }

  if (await fileExists(legacySymlinkPath)) {
    return readSymlink(legacySymlinkPath);
  }

  // We should only get here is we failed to capture xcode-select's stdout and our
  // other checks failed. Either Apple has moved the symlink to a new location or the user
  // is not using the default install. 99.999% chance it's the latter, so issue a warning
  // should we ever hit the edge case.
  let msg = `Could not find path to Xcode by symlinks located in ${symlinkPath}, or ${legacySymlinkPath}`;
  log.warn(msg);
  throw new Error(msg);

}

async function _getPathFromXcodeSelect () {

  let {stdout} = await exec('xcode-select --print-path', {maxBuffer: 524288, timeout: XCODE_SELECT_TIMEOUT});

  let xcodeFolderPath = stdout.replace("\n", "");

  if (util.hasContent(xcodeFolderPath)) {
    return xcodeFolderPath;
  } else if (!util.hasContent(xcodeFolderPath)) {
    throw new Error("xcode-select returned an empty string");
  } else {
    let msg = `xcode-select could not find xcode. Path: ${xcodeFolderPath} does not exist.`;
    log.error(msg);
    throw new Error(msg);
  }
}

function getPath () {
  // first we try using xcode-select to find the path, then we try using the symlinks that Apple has by default

  return _getPathFromXcodeSelect()
          .catch(_getPathFromSymlink);
}

async function getVersion () {

  let xcodePath = await getPath();

  // we want to read the CFBundleShortVersionString from Xcode's plist.
  // It should be in /[root]/XCode.app/Contents/
  let plistPath = xcodePath.replace(XCODE_SUBDIR, "/Contents/Info.plist");

  if (!await fileExists(plistPath)) {
    throw new Error(`Could not get Xcode version. ${plistPath} does not exist on disk.`);
  }

  let cmd = `/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' ${plistPath}`;
  let {stdout} = await exec(cmd, {maxBuffer: 524288, timeout: XCODE_SELECT_TIMEOUT});

  let versionPattern = /\d\.\d\.*\d*/;
  // need to use string#match here; previous code used regexp#exec, which does not return null
  let match = stdout.match(versionPattern);
  if (match === null || !util.hasContent(match[0])) {
    throw new Error(`Could not parse Xcode version. xcodebuild output was: ${stdout}`);
  }

  return match[0];
}

async function getAutomationTraceTemplatePath () {

  let xcodePath = await getPath();

  // for ios 8 and up, the file extension for AutiomationInstrument changed.
  // rather than waste time getting the iOSSDKVersion, just get both paths and see which one exists
  var extensions = ['xrplugin', 'bundle'];
  var pathPrefix = path.resolve(xcodePath, "../Applications/Instruments.app/Contents/PlugIns");
  var pathSuffix = "Contents/Resources/Automation.tracetemplate";
  var automationTraceTemplatePaths = [
    path.resolve(pathPrefix, "AutomationInstrument." + extensions[0], pathSuffix),
    path.resolve(pathPrefix, "AutomationInstrument." + extensions[1], pathSuffix)
  ];

  if (await fileExists(automationTraceTemplatePaths[0])) {
    return automationTraceTemplatePaths[0];
  }

  if (await fileExists(automationTraceTemplatePaths[1])) {
    return automationTraceTemplatePaths[1];
  }

  let msg = `Could not find Automation.tracetemplate in any of the following locations ${automationTraceTemplatePaths.toString()}`;
        log.error(msg);
        throw new Error(msg);

}

function test () {

  let callbacked = function(cb) {
    cb('called back');
  };

  let prom = new Promise (function(s, j) {
    callbacked( async function(a) {
//      a.moosh('hi');
      if (a === 'called back') {
        s(true);
      } else {
        j('fail');
      }
    });
  });

  return prom;
}

async function executiveExec(cmd) {

  return new Promise(function(r, j) {
    try {
      exec(cmd, function(err, stdout, stderr) {
        if (err) { return j(err); }
        r({stdout: stdout, stderr: stderr});
      });
    }
    catch (e){
      j(e);
    }
  });

}

let denodedExec = denodeify(exec, (err, stdout, stderr) => { return [err, {stdout: stdout, stderr: stderr}]; });

//TODO remove the underscore exports
export {getPath, getVersion, getAutomationTraceTemplatePath, _getPathFromSymlink, _getPathFromXcodeSelect, test, executiveExec, denodedExec};
