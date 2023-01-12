// transpile:main

import * as xcode from './lib/xcode';


const {
  getPath, getVersion, getMaxIOSSDK, getMaxIOSSDKWithoutRetry,
  getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry, getClangVersion,
} = xcode;

export {
  getPath, getVersion, getMaxIOSSDK, getMaxIOSSDKWithoutRetry,
  getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry, getClangVersion,
};
export default xcode;
