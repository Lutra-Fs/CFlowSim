import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

export type PerfStats = {
  fps: number
  frameMs: number
  renderer: string
  drawCalls?: number
  triangles?: number
  geometries?: number
  textures?: number
}

export function PerfProbe({
  statsRef,
}: {
  statsRef: React.MutableRefObject<PerfStats | null>
}): null {
  const emaFpsRef = useRef<number | null>(null)

  useFrame((state, delta) => {
    if (!Number.isFinite(delta) || delta <= 0) return
    const fps = 1 / delta
    const ema = emaFpsRef.current === null ? fps : emaFpsRef.current * 0.9 + fps * 0.1
    emaFpsRef.current = ema

    const gl = state.gl as any
    const info = gl?.info
    statsRef.current = {
      fps: ema,
      frameMs: delta * 1000,
      renderer: gl?.constructor?.name ?? 'Renderer',
      drawCalls: info?.render?.calls,
      triangles: info?.render?.triangles,
      geometries: info?.memory?.geometries,
      textures: info?.memory?.textures,
    }
  })

  return null
}

export function PerfOverlay({
  rendererBackend,
  statsRef,
}: {
  rendererBackend: 'webgl' | 'webgpu'
  statsRef: React.MutableRefObject<PerfStats | null>
}): JSX.Element {
  const [snapshot, setSnapshot] = useState<PerfStats | null>(null)
  const backendLabel =
    rendererBackend === 'webgpu' ? 'webgpu (fallback)' : 'webgl (force)'

  useEffect(() => {
    const id = setInterval(() => {
      if (statsRef.current) {
        setSnapshot(statsRef.current)
      }
    }, 250)
    return () => clearInterval(id)
  }, [statsRef])

  return (
    <div className="absolute left-4 top-[calc(var(--header-height)+var(--spacing-4))] z-50 min-w-[180px] rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/90 shadow-[var(--shadow-lg)] backdrop-blur">
      <div className="font-semibold text-white/90">Perf</div>
      <div className="mt-1 flex justify-between gap-3">
        <span className="text-white/60">Backend</span>
        <span className="font-mono">{backendLabel}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Renderer</span>
        <span className="font-mono">
          {snapshot?.renderer ?? '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">FPS</span>
        <span className="font-mono">
          {snapshot ? snapshot.fps.toFixed(1) : '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Frame</span>
        <span className="font-mono">
          {snapshot ? `${snapshot.frameMs.toFixed(1)} ms` : '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Draw calls</span>
        <span className="font-mono">
          {snapshot?.drawCalls ?? '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Triangles</span>
        <span className="font-mono">
          {snapshot?.triangles ?? '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Geometries</span>
        <span className="font-mono">
          {snapshot?.geometries ?? '...'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">Textures</span>
        <span className="font-mono">
          {snapshot?.textures ?? '...'}
        </span>
      </div>
    </div>
  )
}
