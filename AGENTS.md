# Project Guidelines

## Project Overview

**CFlowSim** (previously "Physics in the Browser") is a web application that simulates 2D fluid dynamics using neural networks. The app combines machine learning inference (TensorFlow.js and ONNX Runtime) with interactive 3D visualization using React Three Fiber, all running in the browser.

## Development Commands

```bash
# Development
npm run dev           # Start Vite dev server

# Building
npm run build         # TypeScript compile + Vite build (output: dist/)

# Testing
npm run test          # Run Jest tests

# Code Quality
npm run lint          # ESLint (strict: max-warnings 0)
npm run format        # Prettier format src/**/*.{ts,tsx}
npm run format-check  # Check formatting without modifying

# Commits
npm run commit        # Interactive commit message generator (commitizen)

# Preview
npm run preview       # Preview production build
```

## Architecture

### ML Backend Abstraction

The core architecture uses a factory pattern (`createModelService` in `src/services/model/modelService.ts`) that dynamically selects the ML backend based on the model file extension:

- `.json` → **TensorFlow.js** (WebGL/WebGPU backend with automatic WebGPU fallback)
- `.onnx` → **ONNX Runtime** (WebAssembly backend)
- `.mock` → **MockModelService** (development/testing)

All backends implement the `ModelService` interface, providing a unified API for:
- `startSimulation()` / `pauseSimulation()`
- `bindOutput(callback)` - Register callback for simulation output
- `updateForce(pos, forceDelta)` - Apply external forces to the fluid
- `loadDataArray(array)` / `setMass(mass)` - State management
- `getInputTensor()` / `getInputShape()` - Data access

### Web Worker Architecture

Heavy ML computation runs in a **Web Worker** (`src/workers/modelWorker.ts`) to prevent UI blocking. Communication uses a message-based protocol:

- `RunnerFunc.INIT` - Initialize model service from initial conditions
- `RunnerFunc.START` / `RunnerFunc.PAUSE` - Simulation control
- `RunnerFunc.UPDATE_FORCE` - Apply forces to the fluid
- `RunnerFunc.SERIALIZE` / `RunnerFunc.DESERIALIZE` - Save/restore state

The worker batches simulation outputs and posts them back to the main thread at 1-second intervals for rendering.

### Auto-Save System

The `AutoSaveService` (`src/services/autoSave/autoSaveService.ts`) automatically saves simulation state to IndexedDB every 10 seconds, maintaining a maximum of 5 auto-saves. It uses the `idb` library for IndexedDB access.

### 3D Visualization

The app uses **TSL (Three Shading Language)** for unified WebGL/WebGPU rendering with runtime backend switching:

**Main Components:**
- `src/components/DiffusionPlane.tsx` - TSL-based fluid visualization component (works with both WebGL and WebGPU)
- `src/components/UnifiedCanvas.tsx` - Universal canvas with automatic backend detection and fallback
- `src/components/materials/FluidMaterial.ts` - TSL material factory for fluid rendering

**Key Features:**
- **Runtime Backend Switching**: Switch between WebGL and WebGPU via ParametersBar UI
- **Automatic Fallback**: WebGPU automatically falls back to WebGL when unavailable
- **Code Reuse**: Single TSL material works for both rendering backends
- **Texture Optimization**: Reuses texture objects to avoid GC pressure (no per-frame allocation)
- **Interactive Controls**: Force application via mouse/touch, camera controls via OrbitControls

**Architecture:**
```
UnifiedCanvas (auto-detects WebGPU)
    ↓
DiffusionPlane (TSL material)
    ↓
FluidMaterial (createFluidMaterial - platform-agnostic)
```

**Legacy Components:**
- `src/components/Simulation.tsx` - Original WebGL implementation (GLSL shaders)
- `src/components/WebGPUSimulation.tsx` - Native WebGPU implementation (kept for reference)
- `src/lib/webgpu/` - Native WebGPU pipeline (kept for reference)

### Project Structure

```
src/
├── components/          # React UI components
│   ├── Simulation.tsx   # Main 3D visualization component
│   ├── ControlBar.tsx   # Play/pause/reset controls
│   └── ParametersBar.tsx # Simulation parameter controls
├── services/
│   ├── model/           # ML backend implementations
│   └── autoSave/        # IndexedDB auto-save service
├── workers/             # Web Workers (excluded from tsconfig)
├── shaders/             # GLSL shaders for Three.js
└── pages/               # Route components

public/
├── model/               # ML model files (.json for TF.js, .onnx for ONNX)
└── initData/            # Initial condition JSON files
```

### Asset Loading Configuration

The app supports flexible asset loading via environment-based URL resolution (`src/services/assetUrl/assetUrlService.ts`):

**Development Mode:**
- Loads assets from local `/public/` directory
- Set via `VITE_ASSET_BASE_URL=/public/` in `.env`

**Production Mode:**
- Loads assets from GitHub raw content to reduce bundle size (~25-30 MB)
- Set via `VITE_ASSET_BASE_URL=https://raw.githubusercontent.com/<owner>/<repo>/main/public/` in `.env.production`
- Browser HTTP caching handles repeat visits

**Configuration:**
- `.env` - Local development (gitignored)
- `.env.production` - Production settings (version controlled)
- Update `<owner>` and `<repo>` placeholders with your GitHub repository details


## Code Conventions

### TypeScript Configuration

- **Strict mode enabled** with additional checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- ESNext target with bundler module resolution
- Web Workers are excluded from main tsconfig (they have their own compilation)

### Linting & Formatting

- **ESLint**: React hooks, jsx-a11y, import/type-aware rules, max-warnings 0
- **Prettier**: 2-space tabs, single quotes, semicolons
- Pre-commit hooks run lint-staged automatically

### Commit Messages

Uses **Conventional Commits** with Angular conventions:
- `npm run commit` launches interactive commitizen prompt
- Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
- Commitlint enforces format via husky hooks
- without emoji

### Testing

Jest with ts-jest preset. Tests located in `tests/` directory.

## Key Dependencies

- **ML Frameworks**: `@tensorflow/tfjs`, `@tensorflow/tfjs-backend-webgpu`, `onnxruntime-web`
- **3D Rendering**: `three`, `@react-three/fiber`, `@react-three/drei`
- **UI Framework**: `react`, `shadcn/ui` (with @base-ui components and Tailwind CSS (v4))
- **Database**: `idb` (IndexedDB wrapper)
- **Build Tool**: `vite` with SWC for React

## Important Notes

- WebGPU is automatically detected and falls back to WebGL if unavailable
- Initial condition files must be in `/initData/*.json` format
- Model files are served from `/model/` with backend detection based on extension


Never commit .gitignore files. (you can git add -a then remove .gitignore from stage area).
Never commit CLAUDE.md.

THREE.WebGPURenderer do supports WebGPU first, and it have automatic fallback to WebGL if WebGPU is not available.
TSL only supports new WebGPURenderer.
