import npmlog from 'npmlog';
import { util, fs } from 'appium-support';
import path from 'path';
import { retry } from 'asyncbox';
import _ from 'lodash';
import plist from 'plist';
import { exec } from 'teen_process';

const env = process.env;

const XCODE_SELECT_TIMEOUT = 3000;
const XCODE_SUBDIR = "/Contents/Developer";
const DEFAULT_NUMBER_OF_RETRIES = 3;

const log = process.env.GLOBAL_NPMLOG ? global.log : npmlog;


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
  const legacySymlinkPath = "/usr/share/xcode-select/xcode_dir_link"; //  Xcode < 5.x
  let xcodePath = null;

  // xcode-select allows users to override its settings with the DEVELOPER_DIR env var,
  // so check that first
  if (util.hasContent(env.DEVELOPER_DIR)) {
    const customPath = hasExpectedSubDir(env.DEVELOPER_DIR) ?
                                         env.DEVELOPER_DIR  :
                                         env.DEVELOPER_DIR + XCODE_SUBDIR;

    if (await fs.exists(customPath)) {
      xcodePath = customPath;
    } else {
      let mesg = `Could not find path to Xcode, environment variable ` +
                 `DEVELOPER_DIR set to: ${env.DEVELOPER_DIR} ` +
                 `but no Xcode found`;
      log.warn(mesg);
      throw new Error(mesg);
    }
  } else if (await fs.exists(symlinkPath)) {
    xcodePath = fs.readlink(symlinkPath);
  } else if (await fs.exists(legacySymlinkPath)) {
    xcodePath = fs.readlink(legacySymlinkPath);
  }

  if (xcodePath) {
    return xcodePath.replace(new RegExp("/$"), "").trim();
  }

  // We should only get here is we failed to capture xcode-select's stdout and our
  // other checks failed. Either Apple has moved the symlink to a new location or the user
  // is not using the default install. 99.999% chance it's the latter, so issue a warning
  // should we ever hit the edge case.
  let msg = `Could not find path to Xcode by symlinks located in ${symlinkPath}, or ${legacySymlinkPath}`;
  log.warn(msg);
  throw new Error(msg);

}

async function getPathFromXcodeSelect () {

  let {stdout} = await exec('xcode-select', ['--print-path'], {timeout: XCODE_SELECT_TIMEOUT});

  // trim and remove trailing slash
  const xcodeFolderPath = stdout.replace(new RegExp("/$"), "").trim();

  if (!util.hasContent(xcodeFolderPath)) {
    throw new Error("xcode-select returned an empty string");
  }

  if (await fs.exists(xcodeFolderPath)) {
    return xcodeFolderPath;
  } else {
    const msg = `xcode-select could not find xcode. Path: ${xcodeFolderPath} does not exist.`;
    log.error(msg);
    throw new Error(msg);
  }
}

const getPath = _.memoize(function () {

  // first we try using xcode-select to find the path
  // then we try using the symlinks that Apple has by default

  return getPathFromXcodeSelect().catch(getPathFromSymlink);
});



async function getVersionWithoutRetry () {

  let xcodePath = await getPath();

  // we want to read the CFBundleShortVersionString from Xcode's plist.
  // It should be in /[root]/XCode.app/Contents/
  const plistPath = path.resolve(xcodePath, "..", "Info.plist");

  if (!await fs.exists(plistPath)) {
    throw new Error(`Could not get Xcode version. ${plistPath} does not exist on disk.`);
  }

  const cmd = `/usr/libexec/PlistBuddy`;
  const args =  ['-c', 'Print CFBundleShortVersionString', plistPath];
  let {stdout} = await exec(cmd, args, {timeout: XCODE_SELECT_TIMEOUT});

  let versionPattern = /\d\.\d\.*\d*/;
  // need to use string#match here; previous code used regexp#exec, which does not return null
  let match = stdout.match(versionPattern);
  if (match === null || !util.hasContent(match[0])) {
    throw new Error(`Could not parse Xcode version. xcodebuild output was: ${stdout}`);
  }

  return match[0];
}


const getVersion = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES) {
    return retry(retries, getVersionWithoutRetry);
  }
);

async function getAutomationTraceTemplatePathWithoutRetry () {

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

  if (await fs.exists(automationTraceTemplatePaths[0])) {
    return automationTraceTemplatePaths[0];
  }

  if (await fs.exists(automationTraceTemplatePaths[1])) {
    return automationTraceTemplatePaths[1];
  }

  const msg = "Could not find Automation.tracetemplate in any of the following" +
              `locations ${automationTraceTemplatePaths.toString()}`;
  log.error(msg);
  throw new Error(msg);

}

const getAutomationTraceTemplatePath = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES) {
    return retry(retries, getAutomationTraceTemplatePathWithoutRetry);
  }
);

async function getMaxIOSSDKWithoutRetry () {

  const version = await getVersion();

  if (version[0] === '4') {
    return '6.1';
  }

  const cmd = `xcrun`;
  const args = ['--sdk',  'iphonesimulator',  '--show-sdk-version'];
  const {stdout} = await exec(cmd, args, {timeout: XCODE_SELECT_TIMEOUT});

  const sdkVersion = stdout.trim();
  const match = /\d.\d/.exec(stdout);

  if (!match) {
    throw new Error(`xcrun returned a non-numeric iOS SDK version: ${sdkVersion}`);
  }

  return sdkVersion;
}

const getMaxIOSSDK = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES) {
    return retry(retries, getMaxIOSSDKWithoutRetry);
  }
);

async function getConnectedDevices () {

  const cmd = '/usr/sbin/system_profiler';
  const args = ['-xml', 'SPUSBDataType'];
  let {stdout} = await exec(cmd, args, {timeout: XCODE_SELECT_TIMEOUT});
  let plistContent = plist.parse(stdout);

  let devicesFound = [];
  let entriesToSearch = [plistContent[0]];
  while (entriesToSearch.length > 0) {
    let currentEntry = entriesToSearch.pop();
    if (currentEntry instanceof Array) {
      entriesToSearch = entriesToSearch.concat(currentEntry);
    } else if ((currentEntry._name &&
                currentEntry._name.substring(0, 4) === "iPad") ||
               (currentEntry._name &&
                currentEntry._name.substring(0, 6) === "iPhone")) {
      let deviceInfo = {
        name: currentEntry._name,
        udid: currentEntry.serial_num,
        productId: currentEntry.product_id,
        deviceVersion: currentEntry.bcd_device
      };
      devicesFound.push(deviceInfo);
    } else if (currentEntry._items) {
      entriesToSearch = entriesToSearch.concat(currentEntry._items);
    }
  }
  return devicesFound;
}

async function getInstrumentsPathWithoutRetry () {

  const cmd = 'xcrun';
  const args = ['-find', 'instruments'];
  let {stdout} = await exec(cmd, args, {timeout: XCODE_SELECT_TIMEOUT});

  if (!stdout) {
    stdout = "";
  }

  let instrumentsPath = stdout.trim();

  if (!instrumentsPath) {
    throw new Error(`Could not find path to instruments binary using "${cmd}"`);
  }

  return instrumentsPath;
}

const getInstrumentsPath = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES) {
    return retry(retries, getInstrumentsPathWithoutRetry);
  }
);

function clearInternalCache () {

  // memoized functions
  const memoized = [getPath, getVersion, getAutomationTraceTemplatePath,
                    getMaxIOSSDK, getInstrumentsPath];

  memoized.forEach((f) => {
    if (f.cache) {
      f.cache = new _.memoize.Cache();
    }
  });
}

export default { getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
         getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
         getConnectedDevices, clearInternalCache, getInstrumentsPath };
