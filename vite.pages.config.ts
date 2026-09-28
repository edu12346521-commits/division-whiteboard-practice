import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "static-site",
  base: "/division-whiteboard-practice/",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../docs", emptyOutDir: true },
});
