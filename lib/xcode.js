import { util, fs, plist, logger } from 'appium-support';
import path from 'path';
import { retry } from 'asyncbox';
import _ from 'lodash';
import { parse as parsePlistData } from 'plist';
import { exec } from 'teen_process';


const env = process.env;

const XCRUN_TIMEOUT = 15000;
const XCODE_SUBDIR = "/Contents/Developer";
const DEFAULT_NUMBER_OF_RETRIES = 3;

const log = logger.getLogger('Xcode');


function hasExpectedSubDir (path) {
  return path.substring(path.length - XCODE_SUBDIR.length) === XCODE_SUBDIR;
}

async function runXcrunCommand (args, timeout = XCRUN_TIMEOUT) {
  try {
    return await exec('xcrun', args, {timeout});
  } catch (err) {
    // the true error can be hidden within the stderr
    if (err.stderr) {
      err.message = `${err.message}: ${err.stderr}`;
    }

    throw err;
  }
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
    xcodePath = await fs.readlink(symlinkPath);
  } else if (await fs.exists(legacySymlinkPath)) {
    xcodePath = await fs.readlink(legacySymlinkPath);
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

async function getPathFromXcodeSelect (timeout = XCRUN_TIMEOUT) {
  let {stdout} = await exec('xcode-select', ['--print-path'], {timeout});

  // trim and remove trailing slash
  const xcodeFolderPath = stdout.replace(/\/$/, '').trim();

  if (!util.hasContent(xcodeFolderPath)) {
    log.errorAndThrow('xcode-select returned an empty string');
  }

  if (await fs.exists(xcodeFolderPath)) {
    return xcodeFolderPath;
  } else {
    const msg = `xcode-select could not find xcode. Path '${xcodeFolderPath}' does not exist.`;
    log.errorAndThrow(msg);
  }
}

const getPath = _.memoize(function (timeout = XCRUN_TIMEOUT) {
  // first we try using xcode-select to find the path
  // then we try using the symlinks that Apple has by default
  return getPathFromXcodeSelect(timeout).catch(getPathFromSymlink);
});



async function getVersionWithoutRetry (timeout = XCRUN_TIMEOUT) {
  let xcodePath = await getPath(timeout);

  // we want to read the CFBundleShortVersionString from Xcode's plist.
  // It should be in /[root]/XCode.app/Contents/
  const plistPath = path.resolve(xcodePath, "..", "Info.plist");

  if (!await fs.exists(plistPath)) {
    throw new Error(`Could not get Xcode version. ${plistPath} does not exist on disk.`);
  }

  let version = await plist.parsePlistFile(plistPath);
  version = version.CFBundleShortVersionString;

  let versionPattern = /\d\.\d\.*\d*/;
  // need to use string#match here; previous code used regexp#exec, which does not return null
  let match = version.match(versionPattern);
  if (match === null || !util.hasContent(match[0])) {
    log.errorAndThrow(`Could not parse Xcode version. xcodebuild output was: ${version}`);
  }

  return match[0];
}

const getVersionMemoized = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getVersionWithoutRetry, timeout);
  }
);

async function getVersion (parse = false, retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
  let version = await getVersionMemoized(retries, timeout);
  if (!parse) {
    return version;
  }
  let match = /^(\d+)\.(\d+)(\.(\d+))?$/.exec(version);
  // match should be an array, either of
  //     [ '7.0', '7', '0', undefined, undefined, index: 0, input: '7.0' ]
  //     [ '7.0.1', '7', '0', '.1', '1', index: 0, input: '7.0.1' ]
  return {
    versionString: version,
    versionFloat: parseFloat(`${match[1]}.${match[2]}`),
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[4] ? parseInt(match[4], 10) : undefined
  };
}

async function getCommandLineToolsVersion () {
  let stdout;
  try {
    stdout = (await exec('pkgutil', [`--pkg-info=com.apple.pkg.CLTools_Executables`])).stdout;
  } catch (err) {
    try {
      stdout = (await exec('pkgutil', [`--pkg-info=com.apple.pkg.DeveloperToolsCLI`])).stdout;
    } catch (err) {
      stdout = '';
    }
  }

  // stdout should have a line like `version: 8.0.0.0.1.1472435881`
  let match = /^version: (.+)$/m.exec(stdout); // https://regex101.com/r/HV3x4d/1
  return match ? match[1] : undefined;
}

async function getAutomationTraceTemplatePathWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const xcodePath = await getPath(timeout);

  // for ios 8 and up, the file extension for AutiomationInstrument changed.
  // rather than waste time getting the iOSSDKVersion, just get both paths and see which one exists
  const extensions = ['xrplugin', 'bundle'];
  const pathPrefix = path.resolve(xcodePath, "../Applications/Instruments.app/Contents/PlugIns");
  const pathSuffix = "Contents/Resources/Automation.tracetemplate";
  let automationTraceTemplatePaths = [
    path.resolve(pathPrefix, `AutomationInstrument.${extensions[0]}`, pathSuffix),
    path.resolve(pathPrefix, `AutomationInstrument.${extensions[1]}`, pathSuffix)
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
  function (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getAutomationTraceTemplatePathWithoutRetry, timeout);
  }
);

async function getMaxIOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const version = await getVersion(false, DEFAULT_NUMBER_OF_RETRIES, timeout);
  if (version[0] === '4') {
    return '6.1';
  }

  const args = ['--sdk',  'iphonesimulator',  '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);

  const sdkVersion = stdout.trim();
  const match = /\d.\d/.exec(stdout);

  if (!match) {
    throw new Error(`xcrun returned a non-numeric iOS SDK version: '${sdkVersion}'`);
  }

  return sdkVersion;
}

const getMaxIOSSDK = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getMaxIOSSDKWithoutRetry, timeout);
  }
);

async function getMaxTVOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const args = ['--sdk',  'appletvsimulator',  '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);

  const sdkVersion = stdout.trim();

  if (isNaN(parseFloat(sdkVersion))) {
    throw new Error(`xcrun returned a non-numeric tvOS SDK version: '${sdkVersion}'`);
  }

  return sdkVersion;
}

const getMaxTVOSSDK = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getMaxTVOSSDKWithoutRetry, timeout);
  }
);

async function getConnectedDevices (timeout = XCRUN_TIMEOUT) {
  const cmd = '/usr/sbin/system_profiler';
  const args = ['-xml', 'SPUSBDataType'];
  let {stdout} = await exec(cmd, args, {timeout});
  let plistContent = parsePlistData(stdout);

  let devicesFound = [];
  let entriesToSearch = [plistContent[0]];
  while (entriesToSearch.length > 0) {
    let currentEntry = entriesToSearch.pop();
    if (currentEntry instanceof Array) {
      entriesToSearch = entriesToSearch.concat(currentEntry);
    } else if ((currentEntry._name &&
                currentEntry._name.substring(0, 4) === "iPad") ||
               (currentEntry._name &&
                currentEntry._name.substring(0, 6) === "iPhone") ||
               (currentEntry._name && _.includes(currentEntry._name, "Apple TV"))) {
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

async function getInstrumentsPathWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const args = ['-find', 'instruments'];
  let {stdout} = await runXcrunCommand(args, timeout);

  if (!stdout) {
    stdout = "";
  }

  let instrumentsPath = stdout.trim();

  if (!instrumentsPath) {
    throw new Error(`Could not find path to instruments binary using 'xcrun ${args.join(' ')}'`);
  }

  return instrumentsPath;
}

const getInstrumentsPath = _.memoize(
  function (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getInstrumentsPathWithoutRetry, timeout);
  }
);

function clearInternalCache () {

  // memoized functions
  const memoized = [getPath, getVersionMemoized, getAutomationTraceTemplatePath,
                    getMaxIOSSDK, getMaxTVOSSDK, getInstrumentsPath];

  memoized.forEach((f) => {
    if (f.cache) {
      f.cache = new _.memoize.Cache();
    }
  });
}

export default { getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
         getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
         getConnectedDevices, clearInternalCache, getInstrumentsPath,
         getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry };
