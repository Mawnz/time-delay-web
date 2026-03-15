import { Capacitor } from '@capacitor/core';

/** True when running inside a native Capacitor shell (Android / iOS). */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** True when running on Android. */
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

/** True when running on iOS. */
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

/** True when running in a regular browser (dev mode). */
export const isWeb = (): boolean => Capacitor.getPlatform() === 'web';
