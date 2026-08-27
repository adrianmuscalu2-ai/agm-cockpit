export const OWNER_ANDROID_SERIAL = 'RFCY70WDHXK';

export function rejectAuthMockingOnOwnerDevice({ runner, serial = OWNER_ANDROID_SERIAL }) {
  if (serial === OWNER_ANDROID_SERIAL) {
    throw new Error(
      `${runner}: BLOCKED - auth/API mocking is forbidden in the Product Owner Android WebView. ` +
      'Use a real authenticated session runner; use mocks only on an isolated emulator or dedicated test device.',
    );
  }
}
