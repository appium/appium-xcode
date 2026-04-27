import {exec} from 'teen_process';
import type {TeenProcessExecResult} from 'teen_process';
import {fs, plist} from '@appium/support';
import path from 'node:path';

export const XCRUN_TIMEOUT = 15000;

/**
 * Memoizes function calls by caching results for serialized argument lists.
 *
 * @param fn The function to memoize
 * @returns A memoized wrapper around the input function
 */
export function memoize<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const cache = new Map<string, Result>();
  return (...args: Args): Result => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    return cache.get(key) as Result;
  };
}

/**
 * Executes 'xcrun' command line utility
 *
 * @param args xcrun arguments
 * @param timeout The maximum number of milliseconds to wait until xcrun exists
 * @returns The result of xcrun execution
 * @throws {Error} If xcrun returned non-zero exit code or timed out
 */
export async function runXcrunCommand(
  args: string[],
  timeout: number = XCRUN_TIMEOUT,
): Promise<TeenProcessExecResult<string>> {
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
    ({stdout} = await exec('/usr/bin/mdfind', [`kMDItemCFBundleIdentifier=${bundleId}`]));
  } catch {
    return [];
  }

  const matchedPaths = stdout
    .trim()
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!matchedPaths.length) {
    return [];
  }
  const results = matchedPaths.map((p) =>
    (async () => {
      if (await fs.exists(p)) {
        return p;
      }
    })(),
  );
  return (await Promise.all(results)).filter(Boolean) as string[];
}

/**
 * Finds and retrieves the content of the Xcode's Info.plist file
 *
 * @param developerRoot Full path to the Contents/Developer folder under Xcode.app root
 * @returns All plist entries as an object or an empty object if no plist was found
 */
export async function readXcodePlist(developerRoot: string): Promise<Record<string, any>> {
  const plistPath = path.resolve(developerRoot, '..', 'Info.plist');
  return (await fs.exists(plistPath)) ? await plist.parsePlistFile(plistPath) : {};
}
