import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import electron from "vite-plugin-electron/simple"

// Editors built on Electron (VS Code) leak this into child shells and it would start Electron as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            // CommonJS keeps __dirname and plays well with Electron's loader.
            lib: {
              entry: "electron/main.ts",
              formats: ["cjs"],
              fileName: () => "[name].cjs",
            },
            sourcemap: true,
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            rolldownOptions: {
              output: { format: "cjs", entryFileNames: "[name].cjs" },
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@shared": resolve(import.meta.dirname, "./shared"),
    },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
})
