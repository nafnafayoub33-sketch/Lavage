/**
 * babel.config.js
 *
 * Metro already defaults to babel-preset-expo, so this changes nothing about
 * the app build. It exists because jest-expo transforms test files with
 * babel-jest, which needs a config file on disk to find the preset — without
 * it, Jest cannot parse TypeScript or JSX.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
