/*
 * @Author: luoqi 575920678@qq.com
 * @Date: 2026-05-23 10:00:50
 * @LastEditors: luoqi 575920678@qq.com
 * @LastEditTime: 2026-05-23 11:03:12
 * @FilePath: /background-remove/vite.config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: '.',
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        worker: resolve(__dirname, 'src/worker/worker.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        '@huggingface/transformers',
        'onnxruntime-web',
        'dexie',
      ],
      output: {
        globals: {
          '@huggingface/transformers': 'transformers',
          'onnxruntime-web': 'ort',
          'dexie': 'Dexie',
        },
        exports: 'named',
      },
    },
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
    chunkSizeWarningLimit: 3000,
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.build.json',
      outDir: 'dist',
      entryRoot: 'src',
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
