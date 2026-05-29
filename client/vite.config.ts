import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@monaco-editor")) return "monaco-editor";
          if (id.includes("node_modules/monaco-editor")) return "monaco-editor";
          if (id.includes("node_modules/echarts") || id.includes("node_modules/echarts-for-react") || id.includes("node_modules/echarts-wordcloud"))
            return "echarts";
          if (id.includes("node_modules/@arco-design")) return "arco-design";
          if (id.includes("node_modules/katex") || id.includes("node_modules/rehype-katex") || id.includes("node_modules/remark-math") || id.includes("node_modules/micromark-extension-math"))
            return "katex";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router"))
            return "react-vendor";
        },
      },
    },
  },
});
