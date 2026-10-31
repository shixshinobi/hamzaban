import { cpSync, createReadStream, existsSync, readFileSync } from "node:fs"
import { join, normalize, resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import electron from "vite-plugin-electron/simple"

// Editors built on Electron (VS Code) leak this into child shells and it would start Electron as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
) as { version: string }

/**
 * pdf.js reads some of a document's content with files of its own: the decoders for
 * JPEG 2000 and JBIG2 images, colour profiles, character maps and the standard fonts.
 * Without them those images are left blank. They are served at pdfjs/ during
 * development and copied there in the build; the scripting engine and the fallbacks for
 * runtimes without WebAssembly are left out, since Electron has no need of them.
 */
const PDFJS = resolve(import.meta.dirname, "node_modules/pdfjs-dist")
const PDFJS_DIRS = ["wasm", "cmaps", "standard_fonts", "iccs"]
const pdfjsSkip = (file: string) => /quickjs|nowasm_fallback/.test(file)

function pdfjsResources(): Plugin {
  let outDir = ""
  return {
    name: "hz-pdfjs-resources",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use("/pdfjs/", (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "").split("?")[0]))
        const file = join(PDFJS, rel)
        // normalize() gives backslashes on Windows.
        const dir = rel.replace(/^[\\/]+/, "").split(/[\\/]/)[0]
        if (
          !PDFJS_DIRS.includes(dir) ||
          !file.startsWith(PDFJS) ||
          pdfjsSkip(file) ||
          !existsSync(file)
        )
          return next()
        if (file.endsWith(".wasm"))
          res.setHeader("Content-Type", "application/wasm")
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      // Only the renderer's build; Electron's main and preload builds go elsewhere.
      if (!existsSync(join(outDir, "index.html"))) return
      for (const dir of PDFJS_DIRS)
        cpSync(join(PDFJS, dir), join(outDir, "pdfjs", dir), {
          recursive: true,
          filter: (src) => !pdfjsSkip(src),
        })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  // package.json is the one place the version is written; releases are tagged from it.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    pdfjsResources(),
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
