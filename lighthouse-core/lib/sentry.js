const log = require('./log');

// eslint-disable-next-line max-len
const SENTRY_URL = 'https://a6bb0da87ee048cc9ae2a345fc09ab2e:63a7029f46f74265981b7e005e0f69f8@sentry.io/174697';

// Fix the polyfill. See https://github.com/GoogleChrome/lighthouse/issues/73
self.setImmediate = function(...args) {
  const callback = args[0];
  Promise.resolve().then(() => callback(...args));
  return 0;
};

const noop = () => undefined;
const sentryApi = {
  captureMessage: noop,
  captureException: noop,
  captureBreadcrumb: noop,
  mergeContext: noop,
  getContext: noop,
};

/**
 * We'll create a delegate for sentry so that environments without error reporting enabled will use
 * noop functions and environments with error reporting will call the actual Sentry methods.
 */
const sentryDelegate = Object.assign({}, sentryApi);
sentryDelegate.init = function init(useSentry, config) {
  if (!useSentry) {
    // If error reporting is disabled, leave the functions as a noop
    return;
  }

  config = Object.assign({}, config, {allowSecretKey: true});

  try {
    const Sentry = require('raven');
    Sentry.config(SENTRY_URL, config).install();
    Object.keys(sentryApi).forEach(functionName => {
      // Have each delegate function call the corresponding sentry function by default
      sentryDelegate[functionName] = (...args) => Sentry[functionName](...args);

      // Special case captureException to skip reporting if the error was expected
      sentryDelegate.captureException = (...args) => {
        if (args[0] && args[0].expected) return;
        Sentry.captureException(...args);
      };
    });
  } catch (e) {
    log.warn(
      'sentry',
      'Could not load raven library, errors will not be reported.'
    );
  }
};

module.exports = sentryDelegate;
