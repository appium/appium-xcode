export interface XcodeVersion {
  /** The Xcode version as a string, e.g. '10.0' or '10.0.1' */
  versionString: string;
  /** The Xcode version as a float, e.g. 10.0 or 10.1 */
  versionFloat: number;
  /** The major version number, e.g. 10 */
  major: number;
  /** The minor version number, e.g. 1 */
  minor: number;
  /** The patch version number, if present in the version string */
  patch?: number;
  /** Returns {@link versionString} */
  toString(): string;
}
