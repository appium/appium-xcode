export interface XcodeVersion {
  versionString: string;
  versionFloat: number;
  major: number;
  minor: number;
  patch?: number;
  toString(): string;
}

