module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      './src/tasarim-sistemi/tema/babel-plugin-tamuso-tema.js',
      'react-native-reanimated/plugin',
    ],
  };
};
