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

/**
 * @typedef {import('./xcode').XcodeVersion} XcodeVersion
 */
