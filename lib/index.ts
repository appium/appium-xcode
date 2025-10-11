// transpile:main
import {
  getPath,
  getVersion,
  getMaxIOSSDK,
  getMaxTVOSSDK,
  getClangVersion,
} from './xcode';

const xcode = {
  getPath,
  getVersion,
  getMaxIOSSDK,
  getMaxTVOSSDK,
  getClangVersion
};

export {
  getPath,
  getVersion,
  getMaxIOSSDK,
  getMaxTVOSSDK,
  getClangVersion
};
export default xcode;

export type { XcodeVersion } from './xcode';

