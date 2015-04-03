import npmlog from 'npmlog';
import support from 'appium-support';
import fs from 'fs';
import denodeify from 'denodeify';
import path from 'path';
import 'traceur/bin/traceur-runtime';

const exec = support.core.exec;
const util = support.util;
const fileExists = support.util.fileExists;
const readSymlink = denodeify(fs.readlink);
const env = process.env;

const XCODE_SELECT_TIMEOUT = 3000;
const XCODE_SUBDIR = "/Contents/Developer";

const log = process.env.GLOBAL_NPMLOG ? global.log : npmlog;

// we cache some values returned by the functions in this module, because running full `exec` functions are costly, and these functions a utilities used often
let cache = {};

function hasExpectedSubDir (path) {
  return path.substring(path.length - XCODE_SUBDIR.length) === XCODE_SUBDIR;
}

async function getPathFromSymlink (failMessage) {
  // Node's invocation of xcode-select sometimes flakes and returns an empty string.
  // Not clear why. As a workaround, Appium can reliably deduce the version in use by checking
  // the locations xcode-select uses to store the selected version's path. This should be 100%
  // reliable so long as the link locations remain the same. However, since we're relying on
  // hardcoded paths, this approach will break the next time Apple changes the symlink location.
  log.warn(`Finding XcodePath by symlink because ${failMessage}`);

  const symlinkPath = "/var/db/xcode_select_link";
  const legacySymlinkPath = "/usr/share/xcode-select/xcode_dir_path"; //  Xcode < 5.x (?)

  // xcode-select allows users to override its settings with the DEVELOPER_DIR env var,
  // so check that first
  if (util.hasContent(env.DEVELOPER_DIR)) {
    return hasExpectedSubDir(env.DEVELOPER_DIR) ? env.DEVELOPER_DIR : env.DEVELOPER_DIR + XCODE_SUBDIR;
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
  const msg = `Could not find path to Xcode by symlinks located in ${symlinkPath}, or ${legacySymlinkPath}`;
  log.warn(msg);
  throw new Error(msg);

}

async function getPathFromXcodeSelect () {

  let [stdout] = await exec('xcode-select --print-path', {maxBuffer: 524288, timeout: XCODE_SELECT_TIMEOUT});

  // trim and remove trailing slash
  const xcodeFolderPath = stdout.replace(new RegExp("/$"), "").trim();

  if (!util.hasContent(xcodeFolderPath)) {
    throw new Error("xcode-select returned an empty string");
  }

  if (await fileExists(xcodeFolderPath)) {
    return xcodeFolderPath;
  } else {
    const msg = `xcode-select could not find xcode. Path: ${xcodeFolderPath} does not exist.`;
    log.error(msg);
    throw new Error(msg);
  }
}

function getPath () {
  // cached function
  if (cache.path) { return cache.path; }

  // first we try using xcode-select to find the path, then we try using the symlinks that Apple has by default

  cache.path = getPathFromXcodeSelect().catch(getPathFromSymlink);

  return cache.path;
}

async function getVersion () {
  // cached function
  if (cache.version) { return cache.version; }

  let xcodePath = await getPath();

  // we want to read the CFBundleShortVersionString from Xcode's plist.
  // It should be in /[root]/XCode.app/Contents/
  const plistPath = xcodePath.replace(XCODE_SUBDIR, "/Contents/Info.plist");

  if (!await fileExists(plistPath)) {
    throw new Error(`Could not get Xcode version. ${plistPath} does not exist on disk.`);
  }

  const cmd = `/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' ${plistPath}`;
  let [stdout] = await exec(cmd, {maxBuffer: 524288, timeout: XCODE_SELECT_TIMEOUT});

  let versionPattern = /\d\.\d\.*\d*/;
  // need to use string#match here; previous code used regexp#exec, which does not return null
  let match = stdout.match(versionPattern);
  if (match === null || !util.hasContent(match[0])) {
    throw new Error(`Could not parse Xcode version. xcodebuild output was: ${stdout}`);
  }

  cache.version = match[0];
  return cache.version;
}

async function getAutomationTraceTemplatePath () {

  const xcodePath = await getPath();

  // for ios 8 and up, the file extension for AutiomationInstrument changed.
  // rather than waste time getting the iOSSDKVersion, just get both paths and see which one exists
  const extensions = ['xrplugin', 'bundle'];
  const pathPrefix = path.resolve(xcodePath, "../Applications/Instruments.app/Contents/PlugIns");
  const pathSuffix = "Contents/Resources/Automation.tracetemplate";
  let automationTraceTemplatePaths = [
    path.resolve(pathPrefix, "AutomationInstrument." + extensions[0], pathSuffix),
    path.resolve(pathPrefix, "AutomationInstrument." + extensions[1], pathSuffix)
  ];

  if (await fileExists(automationTraceTemplatePaths[0])) {
    return automationTraceTemplatePaths[0];
  }

  if (await fileExists(automationTraceTemplatePaths[1])) {
    return automationTraceTemplatePaths[1];
  }

  const msg = `Could not find Automation.tracetemplate in any of the following locations ${automationTraceTemplatePaths.toString()}`;
  log.error(msg);
  throw new Error(msg);

}

export {getPath, getVersion, getAutomationTraceTemplatePath};
