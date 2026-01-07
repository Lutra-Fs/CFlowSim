import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

// Plugin to copy ONNX Runtime WASM files without hash to dist/assets
function copyOnnxWasmFiles(): Plugin {
  return {
    name: 'copy-onnx-wasm-files',
    writeBundle() {
      const files = [
        'ort-wasm-simd-threaded.asyncify.mjs',
        'ort-wasm-simd-threaded.asyncify.wasm',
        'ort-wasm-simd-threaded.mjs',
        'ort-wasm-simd-threaded.wasm',
      ]

      const sourceDir = resolve(__dirname, 'node_modules/onnxruntime-web/dist')
      const targetDir = resolve(__dirname, 'dist/assets')

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      for (const file of files) {
        const sourcePath = resolve(sourceDir, file)
        const targetPath = resolve(targetDir, file)
        if (existsSync(sourcePath)) {
          copyFileSync(sourcePath, targetPath)
          console.log(`Copied ${file} to dist/assets/`)
        }
      }
    },
  }
}

// Middleware to serve WASM files with correct MIME type
function wasmMiddleware(): Plugin {
  return {
    name: 'wasm-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
        }
        next()
      })
    },
  }
}

// Plugin to exclude large asset files from production build
// In dev mode, files are served from public/ normally
// In production build, we remove model/ and initData/ from dist/ since they're loaded from GitHub
// Function factory to capture mode and env from config
function excludeLargeAssets(mode: string, env: Record<string, string>): Plugin {
  return {
    name: 'exclude-large-assets',
    writeBundle() {
      const includeAssets = env.VITE_INCLUDE_ASSETS === 'true'

      // Exclude assets in production mode unless standalone
      if (mode === 'production' && !includeAssets) {
        const distDir = resolve(__dirname, 'dist')
        const dirsToRemove = ['model', 'initData']

        for (const dir of dirsToRemove) {
          const targetPath = resolve(distDir, dir)
          if (existsSync(targetPath)) {
            rmSync(targetPath, { recursive: true, force: true })
            console.log(`Excluded ${dir}/ from production build (loaded from GitHub)`)
          }
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for config access (includes non-VITE_ prefixed vars)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      copyOnnxWasmFiles(),
      wasmMiddleware(),
      excludeLargeAssets(mode, env),
    ],
    // Define global constants for dead code elimination
    define: {
      __DEV__: JSON.stringify(mode !== 'production'),
      __PROD__: JSON.stringify(mode === 'production'),
      // Use loaded env var, NOT process.env.VITE_* (which doesn't work in config)
      'import.meta.env.VITE_ASSET_PREFIX': JSON.stringify(
        env.VITE_ASSET_PREFIX || '/',
      ),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
      // Exclude onnxruntime-web from pre-bundling to avoid WASM path issues
      exclude: ['onnxruntime-web'],
    },
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          dead_code: true,
          drop_console: true,
        },
      },
    },
    // Ensure WASM files are treated as assets and served with correct MIME type
    assetsInclude: ['**/*.wasm'],
    server: {
      fs: {
        // Allow serving files from node_modules/onnxruntime-web
        allow: ['..'],
      },
    },
    // Vitest configuration
    test: {
      globals: true,
      environment: 'node',
      clearMocks: true,
      alias: {
        '@': resolve(__dirname, './src'),
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  }
})
