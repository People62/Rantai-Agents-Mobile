/**
 * Entry point aplikasi (bare React Native).
 * Import gesture-handler HARUS paling atas untuk React Navigation.
 * @format
 */
import 'react-native-gesture-handler';
// Terapkan font Poppins ke seluruh Text/TextInput (harus sebelum App dirender).
import './src/lib/fonts';

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
