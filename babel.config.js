module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // react-native-reanimated/gesture-handler tidak dipakai plugin khusus di sini;
    // 'react-native-worklets/plugin' hanya perlu bila memakai Reanimated.
  ],
};
