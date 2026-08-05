import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL cleanup between tests so the serialized Windows pool stays isolated.
afterEach(() => {
  cleanup();
});
