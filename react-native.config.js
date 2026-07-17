/**
 * Konfigurasi React Native CLI. `assets` menautkan font kustom (Poppins) ke
 * build native. File font ada di ./assets/fonts dan sudah disalin ke
 * android/app/src/main/assets/fonts agar terbawa saat `bun run android`.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
};
