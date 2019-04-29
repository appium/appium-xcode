// transpile:main

import * as xcode from './lib/xcode';


const {
  getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
  getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
  getConnectedDevices, clearInternalCache, getInstrumentsPath,
  getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry,
  getClangVersion,
} = xcode;

export {
  getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
  getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
  getConnectedDevices, clearInternalCache, getInstrumentsPath,
  getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry,
  getClangVersion,
};
export default xcode;
