# Rantai-Agent-Mobile

Aplikasi mobile **React Native murni (bare, tanpa Expo)** untuk RantAI Agents.
Klien mobile yang terhubung ke backend RantAI Agents (berbasis website).

- **React Native** 0.86 + **TypeScript**
- **React Navigation** (bottom tabs: Home & Explore)
- **react-native-config** untuk konfigurasi `.env`
- Package manager: **bun**

---

## 1. Prasyarat toolchain (WAJIB untuk build/run)

Berbeda dengan Expo, React Native murni **membangun sendiri di komputer Anda**, jadi perlu:

- **Node.js** ≥ 22.11 dan **bun**
- **JDK 17** (mis. Temurin/OpenJDK 17)
- **Android SDK** via **Android Studio**
  - Set `ANDROID_HOME` (biasanya `~/Android/Sdk`)
  - Tambahkan `platform-tools` ke `PATH` (agar `adb` tersedia)
  - Install: Android SDK Platform 35 + Build-Tools + Platform-Tools + sebuah emulator (AVD)

Cek kesiapan:
```bash
node -v && bun -v && java -version && adb --version
```

> Panduan resmi: https://reactnative.dev/docs/set-up-your-environment (pilih tab **Android / Linux**).

---

## 2. Konfigurasi backend (.env)

Edit `API_URL` di [.env](.env) sesuai target:

| Target                | API_URL                       |
| --------------------- | ----------------------------- |
| HP fisik (WiFi sama)  | `http://192.168.18.93:3000`   |
| Emulator Android      | `http://10.0.2.2:3000`        |
| Simulator iOS (macOS) | `http://localhost:3000`       |

> `.env` di-*bake* saat **build native**. Jika mengubahnya, jalankan ulang `bun run android` (rebuild), bukan sekadar reload Metro.

Pastikan backend `RantAI-Agents` jalan di port 3000:
```bash
cd ../RantAI-Agents && bun run dev
```

---

## 3. Instalasi & menjalankan

```bash
bun install
```

**Emulator Android:**
```bash
# 1) Nyalakan emulator (dari Android Studio > Device Manager), lalu:
bun run android      # build + install + jalankan
```

**HP fisik (Android, via USB):**
```bash
# Aktifkan "USB debugging" di HP, sambungkan USB, cek:
adb devices          # HP harus muncul
bun run android
```

Metro bundler jalan otomatis. Jika perlu manual di terminal terpisah:
```bash
bun run start
```

---

## 4. Struktur proyek

```
App.tsx                 # Root: SafeAreaProvider + NavigationContainer + bottom tabs
index.js                # Entry (registerComponent)
src/
  screens/
    home-screen.tsx     # Status koneksi backend
    explore-screen.tsx  # Halaman info
  components/           # ThemedText, ThemedView
  constants/theme.ts    # Warna, spacing, font
  hooks/                # useColorScheme, useTheme
  lib/api.ts            # Klien backend (pingBackend, chatCompletion)
android/  ios/          # Proyek native
```

---

## Catatan migrasi dari Expo

Proyek ini sebelumnya berbasis Expo dan telah dimigrasikan ke React Native murni:
`expo-router` → React Navigation; modul `expo-*` diganti komponen RN/library setara;
`EXPO_PUBLIC_API_URL` → `API_URL` via `react-native-config`.
