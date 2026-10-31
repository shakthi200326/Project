import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensions: [".mjs", ".js", ".jsx", ".json"],
    dedupe: ["react", "react-dom", "react-router-dom", "lucide-react"],
    alias: {
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
      "lucide-react": path.resolve(__dirname, "node_modules/lucide-react"),
      "@shared": path.resolve(__dirname, "../../../shared/frontend"),
      "@ui": path.resolve(__dirname, "../../../shared/frontend/ui-kit"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ["..", "../../.."],
    },
  },
});
