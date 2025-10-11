import { fs, logger } from '@appium/support';
import path from 'node:path';
import { retry } from 'asyncbox';
import _ from 'lodash';
import { exec } from 'teen_process';
import * as semver from 'semver';
import {
  runXcrunCommand, findAppPaths, XCRUN_TIMEOUT, readXcodePlist
} from './helpers';
import type { XcodeVersion } from './types';

const DEFAULT_NUMBER_OF_RETRIES = 2;
const XCODE_BUNDLE_ID = 'com.apple.dt.Xcode';

const log = logger.getLogger('Xcode');

/**
 * Retrieves the full path to Xcode Developer subfolder via xcode-select
 *
 * @param timeout The maximum timeout for xcode-select execution
 * @returns Full path to Xcode Developer subfolder
 * @throws {Error} If it is not possible to retrieve a proper path
 */
export async function getPathFromXcodeSelect(timeout: number = XCRUN_TIMEOUT): Promise<string> {
  const generateErrorMessage = async (prefix: string): Promise<string> => {
    const xcodePaths = await findAppPaths(XCODE_BUNDLE_ID);
    if (_.isEmpty(xcodePaths)) {
      return `${prefix}. Consider installing Xcode to address this issue.`;
    }

    const proposals = xcodePaths.map((p) => `    sudo xcode-select -s "${path.join(p, 'Contents', 'Developer')}"`);
    return `${prefix}. ` +
      `Consider running${proposals.length > 1 ? ' any of' : ''}:\n${proposals.join('\n')}\nto address this issue.`;
  };

  let stdout: string;
  try {
    ({stdout} = await exec('xcode-select', ['--print-path'], {timeout}));
  } catch (e) {
    const msg = `Cannot determine the path to Xcode by running 'xcode-select -p' command. ` +
    `Original error: ${e.stderr || e.message}`;
    throw new Error(msg);
  }
  // trim and remove trailing slash
  const developerRoot = String(stdout).replace(/\/$/, '').trim();
  if (!developerRoot) {
    const msg = await generateErrorMessage(`'xcode-select -p' returned an empty string`);
    throw new Error(msg);
  }
  // xcode-select might also return a path to command line tools
  const {CFBundleIdentifier} = await readXcodePlist(developerRoot);
  if (CFBundleIdentifier === XCODE_BUNDLE_ID) {
    return developerRoot;
  }

  const msg = await generateErrorMessage(`'${developerRoot}' is not a valid Xcode path`);
  throw new Error(msg);
}

/**
 * Retrieves the full path to Xcode Developer subfolder via `DEVELOPER_DIR` environment variable
 *
 * @returns Full path to Xcode Developer subfolder
 * @throws {Error} If it is not possible to retrieve a proper path
 * @privateRemarks This method assumes `DEVELOPER_DIR` is defined.
 */
export async function getPathFromDeveloperDir(): Promise<string> {
  const developerRoot = process.env.DEVELOPER_DIR as string;
  if (!developerRoot) {
    throw new Error('DEVELOPER_DIR environment variable is not set');
  }

  const {CFBundleIdentifier} = await readXcodePlist(developerRoot);
  if (CFBundleIdentifier === XCODE_BUNDLE_ID) {
    return developerRoot;
  }

  const msg = (
    `The path to Xcode Developer dir '${developerRoot}' provided in DEVELOPER_DIR ` +
    `environment variable is not a valid path`
  );
  throw new Error(msg);
}

/**
 * Retrieves the full path to Xcode Developer subfolder.
 * If `DEVELOPER_DIR` environment variable is provided then its value has a priority.
 * @param timeout The maximum timeout for xcode-select execution
 * @returns Full path to Xcode Developer subfolder timeout
 * @throws {Error} If there was an error while retrieving the path.
 */
export const getPath = _.memoize(
  (timeout: number = XCRUN_TIMEOUT): Promise<string> =>
    process.env.DEVELOPER_DIR ? getPathFromDeveloperDir() : getPathFromXcodeSelect(timeout)
);

/**
 * Retrieves Xcode version
 *
 * @param parse Whether to parse the version to a XcodeVersion version
 * @param retries How many retries to apply for getting the version number
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @returns Xcode version depending on the value of `parse` flag
 * @throws {Error} If there was a failure while retrieving the version
 */
export async function getVersion(parse: false, retries?: number, timeout?: number): Promise<string>;
export async function getVersion(parse: true, retries?: number, timeout?: number): Promise<XcodeVersion>;
export async function getVersion(parse: boolean = false, retries: number = DEFAULT_NUMBER_OF_RETRIES, timeout: number = XCRUN_TIMEOUT): Promise<string | XcodeVersion> {
  const version = await getVersionMemoized(retries, timeout) as semver.SemVer;
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
    toString() {
      return versionString;
    },
  };
}

/**
 * Check https://trac.macports.org/wiki/XcodeVersionInfo
 * to see the actual mapping between clang and other components.
 *
 * @returns The actual Clang version in x.x.x.x or x.x.x format,
 * which is supplied with Command Line Tools. `null` is returned
 * if CLT are not installed.
 */
export async function getClangVersion(): Promise<string | null> {
  try {
    await fs.which('clang');
  } catch {
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
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @returns The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
export async function getMaxIOSSDKWithoutRetry(timeout: number = XCRUN_TIMEOUT): Promise<string> {
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
 * @param retries The maximum number of retries
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @returns The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
export const getMaxIOSSDK = _.memoize(
  function getMaxIOSSDK(retries: number = DEFAULT_NUMBER_OF_RETRIES, timeout: number = XCRUN_TIMEOUT) {
    return retry(retries, getMaxIOSSDKWithoutRetry, timeout);
  }
);

/**
 * Retrieves the maximum version of tvOS SDK supported by the installed Xcode
 *
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @returns The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
export async function getMaxTVOSSDKWithoutRetry(timeout: number = XCRUN_TIMEOUT): Promise<string> {
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
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @param retries The maximum number of retries
 * @returns The SDK version
 * @throws {Error} If the SDK version number cannot be determined
 */
export const getMaxTVOSSDK = _.memoize(
  async function getMaxTVOSSDK(retries: number = DEFAULT_NUMBER_OF_RETRIES, timeout: number = XCRUN_TIMEOUT): Promise<string> {
    return await retry(retries, getMaxTVOSSDKWithoutRetry, timeout) as string;
  }
);

// Private helper functions

/**
 * Retrieves Xcode version
 *
 * @param timeout Timeout of milliseconds to wait for terminal commands.
 * @returns Xcode version
 * @throws {Error} If there was a failure while retrieving the version
 */
async function getVersionWithoutRetry(timeout: number = XCRUN_TIMEOUT): Promise<semver.SemVer | null> {
  const developerPath = await getPath(timeout);
  // we want to read the CFBundleShortVersionString from Xcode's plist.
  const {CFBundleShortVersionString} = await readXcodePlist(developerPath);
  return semver.coerce(CFBundleShortVersionString);
}

/**
 * Retrieves Xcode version or the cached one if called more than once
 *
 * @param retries  How many retries to apply for version retrieval
 * @param timeout Timeout of milliseconds to wait for terminal commands
 * @returns Xcode version
 * @throws {Error} If there was a failure while retrieving the version
 */
const getVersionMemoized = _.memoize(
  function getVersionMemoized(retries: number = DEFAULT_NUMBER_OF_RETRIES, timeout: number = XCRUN_TIMEOUT): Promise<semver.SemVer | null> {
    return retry(retries, getVersionWithoutRetry, timeout);
  }
);
