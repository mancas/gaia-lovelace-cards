import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {};
  }
  return {
    build: {
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => 'custom-ha-cards.js',
      },
      rollupOptions: {
        external: [],
      },
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
