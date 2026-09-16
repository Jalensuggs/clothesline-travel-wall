import { defineConfig } from "vite";

// GitHub Pages 项目页托管在 /<repo>/ 子路径下，构建时需要把 base 设成仓库名；
// 本地开发（vite dev）不受影响，还是跑在根路径。
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/clothesline-travel-wall/" : "/",
});
