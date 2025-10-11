import _ from 'lodash';
import B from 'bluebird';
import { exec, TeenProcessExecResult } from 'teen_process';
import { fs, plist } from '@appium/support';
import path from 'node:path';

export const XCRUN_TIMEOUT = 15000;

/**
 * Executes 'xcrun' command line utility
 *
 * @param args xcrun arguments
 * @param timeout The maximum number of milliseconds to wait until xcrun exists
 * @returns The result of xcrun execution
 * @throws {Error} If xcrun returned non-zero exit code or timed out
 */
export async function runXcrunCommand(args: string[], timeout: number = XCRUN_TIMEOUT): Promise<TeenProcessExecResult<string>> {
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
 * @param bundleId Bundle identifier of the target app
 * @returns Full paths to where the app with the given bundle id is present.
 */
export async function findAppPaths(bundleId: string): Promise<string[]> {
  let stdout: string;
  try {
    ({stdout} = await exec('/usr/bin/mdfind', [
      `kMDItemCFBundleIdentifier=${bundleId}`
    ]));
  } catch {
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
  return (await B.all(results)).filter(Boolean) as string[];
}

/**
 * Finds and retrieves the content of the Xcode's Info.plist file
 *
 * @param developerRoot Full path to the Contents/Developer folder under Xcode.app root
 * @returns All plist entries as an object or an empty object if no plist was found
 */
export async function readXcodePlist(developerRoot: string): Promise<Record<string, any>> {
  const plistPath = path.resolve(developerRoot, '..', 'Info.plist');
  return await fs.exists(plistPath)
    ? await plist.parsePlistFile(plistPath)
    : {};
}
