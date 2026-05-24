/*
 * @Author: luoqi 575920678@qq.com
 * @Date: 2026-05-23 10:54:34
 * @LastEditors: luoqi 575920678@qq.com
 * @LastEditTime: 2026-05-23 14:16:59
 * @FilePath: /background-remove/vite.demo.config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'browser-rmbg': resolve(__dirname, 'src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@huggingface/transformers', 'onnxruntime-web', 'jszip'],
  },
});
