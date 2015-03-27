import npmlog from 'npmlog';
import childProcess from 'child_process';
import support from 'appium-support';
import fs from 'fs';
import denodeify from 'denodeify';

let exec = childProcess.exec;
let stat = fs.stat;
let readLink = fs.readlink;
let util = support.util;
let env = process.env;

let XCODE_SELECT_TIMEOUT = 3000;
let XCODE_SUBDIR = "/Contents/Developer";

let log = process.env.GLOBAL_NPMLOG ? global.log : npmlog;

let fileExists = denodeify(stat);
let readSymlink = denodeify(readLink);

function _hasExpectedSubDir (path) {
  return path.substring(path.length - XCODE_SUBDIR.length) === XCODE_SUBDIR;
}

function _getPathFromSymlink (failMessage) {
  // Node's invocation of xcode-select sometimes flakes and returns an empty string.
  // Not clear why. As a workaround, Appium can reliably deduce the version in use by checking
  // the locations xcode-select uses to store the selected version's path. This should be 100%
  // reliable so long as the link locations remain the same. However, since we're relying on
  // hardcoded paths, this approach will break the next time Apple changes the symlink location.
  log.warn(`Finding XcodePath by symlink because ${failMessage}`);

  let symlinkPath = "/var/db/xcode_select_link";
  let legacySymlinkPath = "/usr/share/xcode-select/xcode_dir_path"; //  Xcode < 5.x (?)

  let checkLinks = async function(resolve, reject) {

    // xcode-select allows users to override its settings with the DEVELOPER_DIR env var,
    // so check that first
    if (util.hasContent(env.DEVELOPER_DIR)) {
      let dir = _hasExpectedSubDir(env.DEVELOPER_DIR) ? env.DEVELOPER_DIR : env.DEVELOPER_DIR + XCODE_SUBDIR;
      return dir;
    } else if (await fileExists(symlinkPath)) {
      resolve(readSymlink(symlinkPath));
    } else if (await fileExists(legacySymlinkPath)) {
      resolve(readSymlink(legacySymlinkPath));
    } else {
      // We should only get here is we failed to capture xcode-select's stdout and our
      // other checks failed. Either Apple has moved the symlink to a new location or the user
      // is not using the default install. 99.999% chance it's the latter, so issue a warning
      // should we ever hit the edge case.
      let msg = `Could not find path to Xcode by symlinks located in ${symlinkPath}, or ${legacySymlinkPath}`;
      log.warn(msg);
      reject(msg);
    }
  };

  let promise = new Promise(checkLinks);

  return promise;
}

function _getPathFromXcodeSelect () {

  let execXcodeSelect = function (resolve, reject) {

    exec('xcode-select --print-path', {maxBuffer: 524288, timeout: XCODE_SELECT_TIMEOUT}, function(err, stdout, stderr) {

      if (err) {
        log.error("xcode-select threw error " + err);
        log.error("Stderr: " + stderr);
        log.error("Stdout: " + stdout);
        reject("xcode-select threw an error: " + err);
      }

      let xcodeFolderPath = stdout.replace("\n", "");

      if (util.hasContent(xcodeFolderPath)) {
        resolve(xcodeFolderPath);
      } else if (!util.hasContent(xcodeFolderPath)) {
        reject("xcode-select returned an empty string");
      } else {
        let msg = `xcode-select could not find xcode. Path: ${xcodeFolderPath} does not exist.`;
        log.error(msg);
        reject(msg);
      }
    });
  };

  let promise = new Promise(execXcodeSelect);

  return promise;
}

function getPath () {
  // first we try using xcode-select to find the path, then we try using the symlinks that Apple has by default

  return _getPathFromXcodeSelect()
        .catch(_getPathFromSymlink);
}

function getAutomationTraceTemplatePath () {

  log.debug("Detecting automation trace template");

}

function test () {

  let callbacked = function(cb) {
    cb('called back');
  };

  let prom = new Promise (function(s, j) {
    callbacked(async function(a) {
      a.moosh('hi');
      if (a === 'called back') {
        s(true);
      } else {
        j('fail');
      }
    });
  });

  return prom;
}

//TODO remove the underscore exports
export {getPath, getAutomationTraceTemplatePath, _getPathFromSymlink, _getPathFromXcodeSelect, test};
