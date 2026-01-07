import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import {
  copyFileSync,
  mkdirSync,
  existsSync,
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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyOnnxWasmFiles(),
    wasmMiddleware(),
  ],
  // Define global constants for dead code elimination
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
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
})
