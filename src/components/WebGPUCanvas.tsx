import { Canvas } from '@react-three/fiber';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';

interface WebGPUCanvasProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  shadows?: boolean;
  camera?: { position: [number, number, number]; fov?: number };
  [key: string]: unknown;
}

export default function WebGPUCanvas(props: WebGPUCanvasProps) {
  const { children, fallback, shadows, camera, ...rest } = props;

  // Check WebGPU availability
  if (!WebGPU.isAvailable()) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Fallback to WebGL
    return (
      <Canvas shadows={shadows} camera={camera} {...(rest as any)}>
        {children}
      </Canvas>
    );
  }

  return (
    <Canvas
      shadows={shadows}
      camera={camera}
      {...(rest as any)}
      gl={async (canvasProps) => {
        const renderer = new WebGPURenderer({
          antialias: true,
          alpha: true,
          ...canvasProps,
        });
        await renderer.init();
        return renderer;
      }}
    >
      {children}
    </Canvas>
  );
}
