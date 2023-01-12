appium-xcode
===================
[![NPM version](http://img.shields.io/npm/v/appium-xcode.svg)](https://npmjs.org/package/appium-xcode)
[![Downloads](http://img.shields.io/npm/dm/appium-xcode.svg)](https://npmjs.org/package/appium-xcode)

[![Release](https://github.com/appium/appium-xcode/actions/workflows/publish.js.yml/badge.svg?branch=master)](https://github.com/appium/appium-xcode/actions/workflows/publish.js.yml)

ES7 module for interacting with Xcode and Xcode-related functions.
Used by various [Appium](github.com/appium/appium) drivers.

API
===

All functions are `async`, meaning they return promises which can be awaited via `await`.

Most functions are memoized, so after they are called once, they will simply return the same value. Remember that calling `require()` multiple times returns the same instantiation of a module if it has already been instantiated, so the memoization will be preserved across multiple files in the same project.

Some functions have an auto-retry built into them, they will retry silently a number of times. This is because the Xcode commands sometimes just flake and return bad values (or don't return).

### getPath([timeout=15000])
*memoized*

gets path to Xcode Developer root.

### getVersion([parse=false], [retries], [timeout])
*memoized*, *retry*

returns the version of Xcode formatted as a string, for example `6.3.1`, or a version object if `parse` is `true`

### getMaxIOSSDK([num_retries])
*memoized*, *retry*

returns the highest IOS SDK version supported by Xcode.
eg: `'8.3'`

### getMaxTVOSSDK([num_retries])
*memoized*, *retry*

returns highest tvOS SDK version supported by Xcode.
eg: `'10.1'`

Develop
=======

## Test

```
npm test
npm e2e-test
```

Debug
=====

After cloning appium-xcode, execute `npm link` in the appium-xcode directory. Next run `npm link appium-xcode` from the appium directory. This will symlink appium-xcode to node_modules/appium-xcode. If the clone becomes out of date remember to unlink or delete node_modules and reinstall.

For quick debugging you could cd into the node_modules/appium-xcode folder and run `npm install` followed by `npm run build`.

