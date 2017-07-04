appium-xcode
===================
[![NPM version](http://img.shields.io/npm/v/appium-xcode.svg)](https://npmjs.org/package/appium-xcode) 
[![Downloads](http://img.shields.io/npm/dm/appium-xcode.svg)](https://npmjs.org/package/appium-xcode)
[![Dependency Status](https://david-dm.org/appium/appium-xcode.svg)](https://david-dm.org/appium/appium-xcode)
[![devDependency Status](https://david-dm.org/appium/appium-xcode/dev-status.svg)](https://david-dm.org/appium/appium-xcode#info=devDependencies)
[![Build Status](https://travis-ci.org/appium/appium-xcode.svg?branch=master)](https://travis-ci.org/appium/appium-xcode)
[![Coverage Status](https://coveralls.io/repos/appium/appium-xcode/badge.svg)](https://coveralls.io/r/appium/appium-xcode)

ES7 module for interacting with Xcode and Xcode-related functions.
Used by [Appium](github.com/appium/appium)

*Note*: Issue tracking for this repo has been disabled. Please use the [main Appium issue tracker](https://github.com/appium/appium/issues) instead.

API
===

All functions are `async`, meaning they return promises which can be awaited via `await`.

Most functions are memoized, so after they are called once, they will simply return the same value. Remember that calling `require()` multiple times returns the same instantiation of a module if it has already been instantiated, so the memoization will be preserved across multiple files in the same project.

Some functions have an auto-retry built into them, they will retry silently a number of times. This is because the Xcode commands sometimes just flake and return bad values (or don't return).

To clear the memoized values, call `clearInternalCache`

### getPath()
*memoized*

gets path to Xcode

### getVersion([num_retries])
*memoized*, *retry*

returns the version of Xcode. Returns strings like `'6.3.1'`

### getAutomationTraceTemplatePath([num_retries])
*memoized, *retry*

returns a path to the default AutomationTraceTemplate

### getAutomationTraceTemplatePathWithoutRetry()

same as `getAutomationTraceTemplatePath()` but without retry or memoization.

### getMaxIOSSDK([num_retries])
*memoized*, *retry*

returns largest IOS SDK version supported by Xcode.
eg: `'8.3'`

### getMaxIOSSDKWithoutRetry()

same as `getMaxIOSDK()` but without retry or memoization

### getMaxTVOSSDK([num_retries])
*memoized*, *retry*

returns largest tvOS SDK version supported by Xcode.
eg: `'10.1'`

### getMaxTVOSSDKWithoutRetry()

same as `getMaxTVOSSDK()` but without retry or memoization

### clearInternalCache()
clears the internal cache used for memoizing functions.

Develop
=======

## Watch

```
npm run watch
```

## Test

```
npm test
```

Debug
=====

After cloning appium-xcode, execute `npm link` in the appium-xcode directory. Next run `npm link appium-xcode` from the appium directory. This will symlink appium-xcode to node_modules/appium-xcode. If the clone becomes out of date remember to unlink or delete node_modules and reinstall.

For quick debugging you could cd into the node_modules/appium-xcode folder and run `npm install` followed by `gulp transpile`.
