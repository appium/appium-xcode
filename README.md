appium-xcode
===================

ES7 module for interacting with Xcode and Xcode-related functions.
Used by [Appium](github.com/appium/appium)

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
_deprecated_ - use `getVersion()` instead.
*memoized*, *retry*

returns largest IOS SDK version supported by Xcode

### getMaxIOSSDKWithoutRetry()
_deprecated_ - use `getVersion()` instead.

same as `getMaxIOSDK()` but without retry or memoization

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
