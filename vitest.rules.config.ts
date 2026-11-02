import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.rules.test.ts'],
    environment: 'node',
    // Todos los archivos comparten el mismo emulador.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
