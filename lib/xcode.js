import { fs, logger } from '@appium/support';
import path from 'path';
import { retry } from 'asyncbox';
import _ from 'lodash';
import { exec } from 'teen_process';
import semver from 'semver';
import {
  runXcrunCommand, findAppPaths, XCRUN_TIMEOUT, readXcodePlist
} from './helpers';

const DEFAULT_NUMBER_OF_RETRIES = 2;
const XCODE_BUNDLE_ID = 'com.apple.dt.Xcode';

const log = logger.getLogger('Xcode');

/**
 * Retrieves the full path to Xcode Developer subfolder via xcode-select
 *
 * @param {number} timeout The maximum timeout for xcode-select execution
 * @returns {Promise<string>} Full path to Xcode Developer subfolder
 * @throws {Error} If it is not possible to retrieve a proper path
 */
async function getPathFromXcodeSelect (timeout = XCRUN_TIMEOUT) {
  /**
   * @param {string} prefix
   * @returns {Promise<string>}
   */
  const generateErrorMessage = async (prefix) => {
    const xcodePaths = await findAppPaths(XCODE_BUNDLE_ID);
    if (_.isEmpty(xcodePaths)) {
      return `${prefix}. Consider installing Xcode to address this issue.`;
    }

    const proposals = xcodePaths.map((p) => `    sudo xcode-select -s "${path.join(p, 'Contents', 'Developer')}"`);
    return `${prefix}. ` +
      `Consider running${proposals.length > 1 ? ' any of' : ''}:\n${proposals.join('\n')}\nto address this issue.`;
  };

  let stdout;
  try {
    ({stdout} = await exec('xcode-select', ['--print-path'], {timeout}));
  } catch (e) {
    const msg = `Cannot determine the path to Xcode by running 'xcode-select -p' command. ` +
    `Original error: ${e.stderr || e.message}`;
    log.error(msg);
    throw new Error(msg);
  }
  // trim and remove trailing slash
  const developerRoot = String(stdout).replace(/\/$/, '').trim();
  if (!developerRoot) {
    const msg = await generateErrorMessage(`'xcode-select -p' returned an empty string`);
    log.error(msg);
    throw new Error(msg);
  }
  // xcode-select might also return a path to command line tools
  const {CFBundleIdentifier} = await readXcodePlist(developerRoot);
  if (CFBundleIdentifier === XCODE_BUNDLE_ID) {
    return developerRoot;
  }

  const msg = await generateErrorMessage(`'${developerRoot}' is not a valid Xcode path`);
  log.error(msg);
  throw msg;
}

/**
 * Retrieves the full path to Xcode Developer subfolder via `DEVELOPER_DIR` environment variable
 *
 * @returns {Promise<string>} Full path to Xcode Developer subfolder
 * @throws {Error} If it is not possible to retrieve a proper path
 * @privateRemarks This method assumes `DEVELOPER_DIR` is defined.
 */
async function getPathFromDeveloperDir () {
  const developerRoot = /** @type {string} */(process.env.DEVELOPER_DIR);
  const {CFBundleIdentifier} = await readXcodePlist(developerRoot);
  if (CFBundleIdentifier === XCODE_BUNDLE_ID) {
    return developerRoot;
  }

  const msg = `The path to Xcode Developer dir '${developerRoot}' provided in DEVELOPER_DIR ` +
  `environment variable is not a valid path`;
  log.error(msg);
  throw new Error(msg);
}

/**
 * Retrieves the full path to Xcode Developer subfolder.
 * If `DEVELOPER_DIR` environment variable is provided then its value has a priority.
 * @param {number} timeout The maximum timeout for xcode-select execution
 * @returns {Promise<string>} Full path to Xcode Developer subfolder timeout
 * @throws {Error} If there was an error while retrieving the path.
 */
const getPath = _.memoize(
  /**
   * @param {number} timeout
   * @returns {Promise<string>}
   */
  (timeout = XCRUN_TIMEOUT) => process.env.DEVELOPER_DIR ? getPathFromDeveloperDir() : getPathFromXcodeSelect(timeout));

/**
 * Retrieves Xcode version
 *
 * @param {number} timeout [15000] Timeout of milliseconds to wait for terminal commands.
 * @returns {Promise<import("semver").SemVer | null>} Xcode version
 * @throws {Error} If there was a failure while retrieving the version
 */
async function getVersionWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const developerPath = await getPath(timeout);
  // we want to read the CFBundleShortVersionString from Xcode's plist.
  const {CFBundleShortVersionString} = await readXcodePlist(developerPath);
  return semver.coerce(CFBundleShortVersionString);
}

/**
 * Retrieves Xcode version or the cached one if called more than once
 *
 * @param {number} retries  How many retries to apply for version retrieval
 * @param {number} timeout Timeout of milliseconds to wait for terminal commands
 * @returns {Promise<import("semver").SemVer | null>} Xcode version
 * @throws {Error} If there was a failure while retrieving the version
 */
const getVersionMemoized = _.memoize(
  function getVersionMemoized (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getVersionWithoutRetry, timeout);
  }
);

/**
 * @typedef {Object} XcodeVersion
 * @property {string} versionString Xcode version as a string
 * @property {number} versionFloat Xcode version as a float number
 * @property {number} major Major number of Xcode version
 * @property {number} minor Minor number of Xcode version
 * @property {number} [patch] Patch number of Xcode version (if exists)
 * @property {() => string} toString Returns Xcode version as a string
 */

/**
 * Retrieves Xcode version
 *
 * @param {boolean} parse [false] Whether to parse the version to a XcodeVersion version
 * @param {number} retries [2] How many retries to apply for getting the version number
 * @param {number} timeout [15000] Timeout of milliseconds to wait for terminal commands
 * @returns {Promise<XcodeVersion | string>} Xcode version depending on the value of `parse` flag
 * @throws {Error} If there was a failure while retrieving the version
 */
async function getVersion (parse = false, retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
  const version = /** @type {import('semver').SemVer} */(await getVersionMemoized(retries, timeout));
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

/**
 * Check https://trac.macports.org/wiki/XcodeVersionInfo
 * to see the actual mapping between clang and other components.
 *
 * @returns {Promise<string|null>} The actual Clang version in x.x.x.x or x.x.x format,
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

/**
 * Retrieves the maximum version of iOS SDK supported by the installed Xcode
 *
 * @param {number} timeout [15000] Timeout of milliseconds to wait for terminal commands
 * @returns {Promise<string>} The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
async function getMaxIOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const args = ['--sdk', 'iphonesimulator', '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);
  const sdkVersion = stdout.trim();
  const match = /\d.\d/.exec(stdout);
  if (!match) {
    throw new Error(`xcrun returned a non-numeric iOS SDK version: '${sdkVersion}'`);
  }
  return sdkVersion;
}

/**
 * Retrieves the maximum version of iOS SDK supported by the installed Xcode
 *
 * @param {number} timeout Timeout of milliseconds to wait for terminal commands
 * @param {number} retries The maximum number of retries
 * @returns {string} The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
const getMaxIOSSDK = _.memoize(
  function getMaxIOSSDK (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return retry(retries, getMaxIOSSDKWithoutRetry, timeout);
  }
);

/**
 * Retrieves the maximum version of tvOS SDK supported by the installed Xcode
 *
 * @param {number} timeout Timeout of milliseconds to wait for terminal commands
 * @returns {Promise<string>} The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
async function getMaxTVOSSDKWithoutRetry (timeout = XCRUN_TIMEOUT) {
  const args = ['--sdk', 'appletvsimulator', '--show-sdk-version'];
  const {stdout} = await runXcrunCommand(args, timeout);
  const sdkVersion = stdout.trim();
  if (isNaN(parseFloat(sdkVersion))) {
    throw new Error(`xcrun returned a non-numeric tvOS SDK version: '${sdkVersion}'`);
  }
  return sdkVersion;
}

/**
 * Retrieves the maximum version of tvOS SDK supported by the installed Xcode
 *
 * @throws {Error} If the SDK version number cannot be determined
 */
const getMaxTVOSSDK = _.memoize(
  /**
   * @param {number} timeout Timeout of milliseconds to wait for terminal commands
   * @param {number} retries The maximum number of retries
   * @returns {Promise<string>} The SDK version
   */
  async function getMaxTVOSSDK (retries = DEFAULT_NUMBER_OF_RETRIES, timeout = XCRUN_TIMEOUT) {
    return /** @type {string} */(await retry(retries, getMaxTVOSSDKWithoutRetry, timeout));
  }
);

export {
  getPath, getVersion, getMaxIOSSDK, getMaxIOSSDKWithoutRetry,
  getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry, getClangVersion,
  getPathFromDeveloperDir, getPathFromXcodeSelect,
};
