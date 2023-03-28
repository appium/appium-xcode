import _ from 'lodash';
import B from 'bluebird';
import { exec } from 'teen_process';
import { fs, plist } from '@appium/support';
import path from 'path';

export const XCRUN_TIMEOUT = 15000;

/**
 * Executes 'xcrun' command line utility
 *
 * @param {string[]} args xcrun arguments
 * @param {number} timeout [15000] The maximum number of milliseconds to wait until xcrun exists
 * @returns {Promise<import("teen_process").TeenProcessExecResult>} The result of xcrun execution
 * @throws {Error} If xcrun returned non-zero exit code or timed out
 */
export async function runXcrunCommand (args, timeout = XCRUN_TIMEOUT) {
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

/**
 * Uses macOS Spotlight service to detect where the given app is installed
 *
 * @param {string} bundleId Bundle identifier of the target app
 * @returns {Promise<string[]>} Full paths to where the app with the given bundle id is present.
 */
export async function findAppPaths (bundleId) {
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
    .map(_.trim)
    .filter(Boolean);
  if (_.isEmpty(matchedPaths)) {
    return [];
  }
  const results = matchedPaths.map((p) => (async () => {
    if (await fs.exists(p)) {
      return p;
    }
  })());
  return /** @type {string[]} */(await B.all(results)).filter(Boolean);
}

/**
 * Finds and retrieves the content of the Xcode's Info.plist file
 *
 * @param {string} developerRoot Full path to the Contents/Developer folder under Xcode.app root
 * @returns {Promise<object>} All plist entries as an object or an empty object if no plist was found
 */
export async function readXcodePlist (developerRoot) {
  const plistPath = path.resolve(developerRoot, '..', 'Info.plist');
  return await fs.exists(plistPath)
    ? await plist.parsePlistFile(plistPath)
    : {};
}
