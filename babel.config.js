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
    // WAJIB paling akhir: plugin worklets untuk react-native-reanimated (v4).
    'react-native-worklets/plugin',
  ],
};
