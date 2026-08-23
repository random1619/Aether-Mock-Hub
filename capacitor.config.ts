import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aether.mocks',
  appName: 'Aether Mocks',
  webDir: 'dist',
  server: {
    // Allow cleartext and handle deep links; the WebView serves from capacitor:// or https://
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#090a0f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#090a0f00',
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
      style: 'DARK',
    },
    Haptics: {},
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#090a0f00',
  },
};

export default config;
