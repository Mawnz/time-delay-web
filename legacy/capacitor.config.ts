import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.timedelay.app',
  appName: 'Delay Player',
  webDir: 'dist',
  android: {
    // Allow mixed content so the WebView can load local file:// resources
    allowMixedContent: true,
  },
  server: {
    // In dev, load from the Bun dev server for hot reload
    // Comment this out for production builds
    // url: 'http://localhost:3000',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    Filesystem: {
      // No special config needed — we use Directory.Data
    },
  },
};

export default config;
