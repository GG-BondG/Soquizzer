import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true, // Testing Library cleans up after each test through the global afterEach
    include: ['src/**/*.test.{js,jsx}'],
  },
});
