// transpile:main

import * as xcode from './lib/xcode';


const {
  getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
  getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
  getConnectedDevices, clearInternalCache, getInstrumentsPath,
  getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry,
} = xcode;

export {
  getPath, getVersion, getAutomationTraceTemplatePath, getMaxIOSSDK,
  getAutomationTraceTemplatePathWithoutRetry, getMaxIOSSDKWithoutRetry,
  getConnectedDevices, clearInternalCache, getInstrumentsPath,
  getCommandLineToolsVersion, getMaxTVOSSDK, getMaxTVOSSDKWithoutRetry,
};
export default xcode;
