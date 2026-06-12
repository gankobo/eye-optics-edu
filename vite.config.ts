import { defineConfig } from 'vite';

// Node.js の process を @types/node なしで最小宣言。
declare const process: { env: Record<string, string | undefined> };

// GitHub Pages 公開時はリポジトリ名を base に設定する。
// 例: https://<user>.github.io/eye-optics-edu/  → base: '/eye-optics-edu/'
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/eye-optics-edu/' : '/',
  build: { outDir: 'dist' },
});
