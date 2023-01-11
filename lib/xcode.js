import { fs, plist, logger } from '@appium/support';
import path from 'path';
import { retry } from 'asyncbox';
import _ from 'lodash';
import { parse as parsePlistData } from 'plist';
import { exec } from 'teen_process';
import semver from 'semver';
import B from 'bluebird';

const XCRUN_TIMEOUT = 15000;
const DEFAULT_NUMBER_OF_RETRIES = 3;
const XCODE_BUNDLE_ID = 'com.apple.dt.Xcode';

const log = logger.getLogger('Xcode');

async function runXcrunCommand (args, timeout = XCRUN_TIMEOUT) {
  try {
    const res = await exec('xcrun', args, {timeout});
    if (_.isUndefined(res)) {
      throw new Error(`Nothing returned from trying to run 'xcrun ${args.join(' ')}'`);
    }
    return res;
  } catch (err) {
    // the true error can be hidden within the stderr
    if (err.stderr) {
      err.message = `${err.message}: ${err.stderr}`;
    }

    throw err;
  }
}

/**
 * Uses macOS Spotlight service to detect where the given app is installed
 *
 * @param {string} bundleId Bundle identifier of the target app
 * @returns {Promise[string[]]} Full paths to where the app with the given bundle id is present.
 */
async function findAppPaths (bundleId) {
  let stdout;
  try {
    ({stdout} = await exec('/usr/bin/mdfind', [
      `kMDItemCFBundleIdentifier=${bundleId}`
    ]));
  } catch (e) {
    return [];
  }

  const matchedPaths = _.trim(stdout)
    .split('\n')
    .map((p) => _.trim(p))
    .filter(Boolean);
  if (_.isEmpty(matchedPaths)) {
    return [];
  }
  const results = matchedPaths.map((p) => (async () => {
    if (await fs.exists(p)) {
      return p;
    }
  })());
  return (await B.all(results)).filter(Boolean);
}

async function getPathFromXcodeSelect (timeout = XCRUN_TIMEOUT) {
  const generateErrorMessage = async (prefix) => {
    const xcodePaths = await findAppPaths(XCODE_BUNDLE_ID);
    if (_.isEmpty(xcodePaths)) {
      return `${prefix}. Consider installing Xcode to address this issue.`;
    }

    const proposals = xcodePaths.map((p) => `    sudo xcode-select -s "${path.join(p, 'Contents', 'Developer')}"`);
    return `${prefix}. ` +
      `Consider running${proposals.length > 1 ? ' any of' : ''}:\n${'\n'.join(proposals)}\nto address this issue.`;
  };

  let stdout;
  try {
    ({stdout} = await exec('xcode-select', ['--print-path'], {timeout}));
  } catch (e) {
    log.errorAndThrow(`Cannot determine the path to Xcode by running 'xcode-select -p' command. ` +
      `Original error: ${e.stderr || e.message}`);
  }
  // trim and remove trailing slash
  const developerFolderPath = stdout.replace(/\/$/, '').trim();
  if (!developerFolderPath) {
    log.errorAndThrow(await generateErrorMessage(`'xcode-select -p' returned an empty string`));
  }
  // xcode-select might also return a path to command line tools
  const plistPath = path.resolve(developerFolderPath, '..', 'Info.plist');
  if (await fs.exists(plistPath)) {
    const {CFBundleIdentifier} = await plist.parsePlistFile(plistPath);
    if (CFBundleIdentifier === XCODE_BUNDLE_ID) {
      return developerFolderPath;
    }
  }

  log.errorAndThrow(await generateErrorMessage(`'${developerFolderPath}' is not a valid Xcode path`));
}

const getPath = _.memoize(function getPath (timeout = XCRUN_TIMEOUT) {
  return (async () => await getPathFromXcodeSelect(timeout))();
});


async function getVersionWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const developerPath = await getPath(timeout);
  // we want to read the CFBundleShortVersionString from Xcode's plist.
  // It should be in /[root]/XCode.app/Contents/
  const plistPath = path.resolve(developerPath, '..', 'Info.plist');
  const {CFBundleShortVersionString} = await plist.parsePlistFile(plistPath);
  return semver.coerce(CFBundleShortVersionString);
}

const getVersionMemoized = _.memoize(
  function getVersionMemoized (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getVersionWithoutRetry, timeout);
  }
);

async function getVersion (parse = false, retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
  const version = await getVersionMemoized(retries, timeout);
  // xcode version strings are not exactly semver string: patch versions of 0
  // are removed (e.g., '10.0.0' => '10.0')
  const versionString = version.patch > 0 ? version.version : `${version.major}.${version.minor}`;
  if (!parse) {
    return versionString;
  }

  return {
    versionString,
    versionFloat: parseFloat(versionString),
    major: version.major,
    minor: version.minor,
    patch: version.patch > 0 ? version.patch : undefined,
    toString () {
      return versionString;
    },
  };
}

async function getCommandLineToolsVersion () {
  // there are a number of different ways that the CLI tools version has been
  // represented. Try them from most reliable to least, falling down the chain
  const getVersionFunctions = [
    async () => {
      let pkg = (await exec('pkgutil', ['--pkgs=com.apple.pkg.DevSDK_.*'])).stdout;
      return (await exec('pkgutil', [`--pkg-info=${pkg.trim()}`])).stdout;
    },
    async () => (await exec('pkgutil', [`--pkg-info=com.apple.pkg.CLTools_Executables`])).stdout,
    async () => (await exec('pkgutil', [`--pkg-info=com.apple.pkg.DeveloperToolsCLI`])).stdout,
  ];
  let stdout;
  for (let getVersion of getVersionFunctions) {
    try {
      stdout = await getVersion();
      break;
    } catch (ign) {
      stdout = '';
    }
  }

  // stdout should have a line like `version: 8.0.0.0.1.1472435881`
  let match = /^version: (.+)$/m.exec(stdout); // https://regex101.com/r/HV3x4d/1
  return match ? match[1] : undefined;
}

/**
 * Check https://trac.macports.org/wiki/XcodeVersionInfo
 * to see the actual mapping between clang and other components.
 *
 * @returns {Promise[string?]} The actual Clang version in x.x.x.x or x.x.x format,
 * which is supplied with Command Line Tools. `null` is returned
 * if CLT are not installed.
 */
async function getClangVersion () {
  try {
    await fs.which('clang');
  } catch (e) {
    log.info('Cannot find clang executable on the local system. ' +
      'Are Xcode Command Line Tools installed?');
    return null;
  }
  const {stdout} = await exec('clang', ['--version']);
  const match = /clang-([0-9.]+)/.exec(stdout);
  if (!match) {
    log.info(`Cannot parse clang version from ${stdout}`);
    return null;
  }
  return match[1];
}

async function getAutomationTraceTemplatePathWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const xcodePath = await getPath(timeout);

  // for ios 8 and up, the file extension for AutiomationInstrument changed.
  // rather than waste time getting the iOSSDKVersion, just get both paths and see which one exists
  const extensions = ['xrplugin', 'bundle'];
  const pathPrefix = path.resolve(xcodePath, '../Applications/Instruments.app/Contents/PlugIns');
  const pathSuffix = 'Contents/Resources/Automation.tracetemplate';
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

  const msg = 'Could not find Automation.tracetemplate in any of the following' +
              `locations ${automationTraceTemplatePaths.toString()}`;
  log.error(msg);
  throw new Error(msg);

}

const getAutomationTraceTemplatePath = _.memoize(
  function getAutomationTraceTemplatePath (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getAutomationTraceTemplatePathWithoutRetry, timeout);
  }
);

async function getMaxIOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const version = await getVersion(false, DEFAULT_NUMBER_OF_RETRIES, timeout);
  if (version[0] === '4') {
    return '6.1';
  }

  const args = ['--sdk', 'iphonesimulator', '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);

  const sdkVersion = stdout.trim();
  const match = /\d.\d/.exec(stdout);

  if (!match) {
    throw new Error(`xcrun returned a non-numeric iOS SDK version: '${sdkVersion}'`);
  }

  return sdkVersion;
}

async function getMaxIOSSDKFromXcodeVersion (timeout = XCRUN_TIMEOUT) {
  const version = await getVersion(true, DEFAULT_NUMBER_OF_RETRIES, timeout);
  // as of now, the iOS version associated with an Xcode version is
  // just the Xcode version + 2
  return `${version.major + 2}.${version.minor}`;
}

const getMaxIOSSDK = _.memoize(
  function getMaxIOSSDK (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    try {
      return retry(retries, getMaxIOSSDKWithoutRetry, timeout);
    } catch (err) {
      log.warn(`Unable to retrieve maximum iOS version: ${err.message}`);
      log.warn('Guessing from Xcode version');
      return getMaxIOSSDKFromXcodeVersion(timeout);
    }
  }
);

async function getMaxTVOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const args = ['--sdk', 'appletvsimulator', '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);

  const sdkVersion = stdout.trim();

  if (isNaN(parseFloat(sdkVersion))) {
    throw new Error(`xcrun returned a non-numeric tvOS SDK version: '${sdkVersion}'`);
  }

  return sdkVersion;
}

const getMaxTVOSSDK = _.memoize(
  function getMaxTVOSSDK (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
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
                currentEntry._name.substring(0, 4) === 'iPad') ||
               (currentEntry._name &&
                currentEntry._name.substring(0, 6) === 'iPhone') ||
               (currentEntry._name && _.includes(currentEntry._name, 'Apple TV'))) {
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
    stdout = '';
  }

  let instrumentsPath = stdout.trim();

  if (!instrumentsPath) {
    throw new Error(`Could not find path to instruments binary using 'xcrun ${args.join(' ')}'`);
  }

  return instrumentsPath;
}

const getInstrumentsPath = _.memoize(
  function getInstrumentsPath (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getInstrumentsPathWithoutRetry, timeout);
  }
);

function clearInternalCache () {

  // memoized functions
  const memoized = [
    getPath, getVersionMemoized, getAutomationTraceTemplatePath, getMaxIOSSDK,
    getMaxTVOSSDK, getInstrumentsPath,
  ];

  memoized.forEach((f) => {
    if (f.cache) {
      f.cache = new _.memoize.Cache();
    }
  });
}

export {
  getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
  getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
  getConnectedDevices, clearInternalCache, getInstrumentsPath,
  getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry,
  getClangVersion,
};
