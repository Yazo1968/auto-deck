import '@testing-library/jest-dom/vitest';

// Polyfill crypto.randomUUID for jsdom
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });
} else if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}
