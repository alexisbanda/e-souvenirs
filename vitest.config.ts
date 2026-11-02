import { configDefaults, defineConfig } from 'vitest/config';

// Los tests de reglas necesitan el emulador: van con `npm run test:rules`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/rules/**'],
  },
});
