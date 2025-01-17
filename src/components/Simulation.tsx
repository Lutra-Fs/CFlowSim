import * as t from 'three';
import {
  useFrame,
  type ThreeElements,
  type ThreeEvent,
} from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import vertexShader from '../shaders/vert.glsl';
import vertexShaderForHeightMap from '../shaders/vert_height.glsl';
import fragmentShader from '../shaders/frag.glsl';
import {
  RunnerFunc,
  type UpdateForceArgs,
} from '../workers/modelWorkerMessage.ts';

// WebGPU imports
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';

class SimulationParams {
  // render options
  densityLowColour: t.Color = new t.Color('blue');
  densityHighColour: t.Color = new t.Color('red');

  renderHeightMap: boolean = false;
  isCameraControlMode: boolean = false;
}

// we will store the parameters in an interface explicitly so
// we can pass the parameter object directly
interface Renderable {
  params: SimulationParams;
  outputSubs: Array<(density: Float32Array[]) => void>;
  worker: Worker;
  disableInteraction: boolean;
}

// TODO: move the rest of renderConfig to SimulationParams
const renderConfig: Record<string, string> = {
  segX: '31.0',
  segY: '31.0',
  width: '10.0',
  height: '8.0',
  segXInt: '32',
  segArea: '1024',
  densityRangeLow: '0.0',
  densityRangeHigh: '10.0',
  densityRangeSize: '10.0',
};

function applyConfigToShader(shader: string): string {
  // match `${varName}` in shader and replace with values
  return shader.replace(
    /\$\{(\w+?)\}/g,
    function (_match: unknown, varName: string) {
      if (renderConfig[varName] !== undefined) {
        return renderConfig[varName];
      }
      return '1.0';
    },
  );
}

// converts a colour to vector3, does not preserve alpha
function colToVec3(col: t.Color): t.Vector3 {
  return new t.Vector3(col.r, col.g, col.b);
}

function DiffusionPlane(
  props: ThreeElements['mesh'] & Renderable,
): JSX.Element {
  // INITIALISATION

  // WebGPU capability test
  if (WebGPU.isAvailable()) {
    const webgpuRenderer = new WebGPURenderer({ antialias: true });
    console.log('browser supports webgpu rendering');
    console.log('webgpu renderer context', webgpuRenderer);
  } else {
    console.log('browser does not support webgpu rendering');
  }

  // reference to the parent mesh
  const ref = useRef<t.Mesh>(null!);

  // create the shader
  const shaderMat = useMemo(() => {
    const shaderMat = new t.ShaderMaterial();
    if (props.params.renderHeightMap) {
      shaderMat.vertexShader = applyConfigToShader(
        vertexShaderForHeightMap as string,
      );
    } else {
      shaderMat.vertexShader = applyConfigToShader(vertexShader as string);
    }
    shaderMat.fragmentShader = applyConfigToShader(fragmentShader as string);
    shaderMat.side = t.DoubleSide;

    // TODO: until we standardise parameters a bit more we'll hardcode
    // an advection size of 32*32
    const initDensity = new Float32Array(new Array(64 * 64).fill(0));
    const tex = new t.DataTexture(
      initDensity,
      64,
      64,
      t.RedFormat,
      t.FloatType,
    );
    tex.needsUpdate = true;

    shaderMat.uniforms = {
      density: { value: tex },
      hiCol: { value: colToVec3(props.params.densityHighColour) },
      lowCol: { value: colToVec3(props.params.densityLowColour) },
    };

    return shaderMat;
  }, [
    props.params.densityHighColour,
    props.params.densityLowColour,
    props.params.renderHeightMap,
  ]);

  // HOOKS

  useFrame((state) => {
    if (disableInteraction) return;
    // potential performance issue?
    state.camera.setRotationFromAxisAngle(new t.Vector3(1, 0, 0), -Math.PI / 2);
    state.camera.position.set(0, 10, 0);
    ref.current.lookAt(0, 99, 0);
  });

  // create a worker and assign it the model computations
  const { outputSubs, worker } = props;

  useEffect(() => {
    console.log('[renderer] [event] Creating worker');
    outputSubs.push((density: Float32Array[]) => {
      output(density);
    });

    // SUBSCRIPTIONS
    // update the density uniforms every time
    // output is received
    function output(data: Float32Array[]): void {
      // create a copy to prevent modifying original data
      data = data.slice(0);
      const param: Record<string, number> = {
        densityRangeHigh: parseFloat(renderConfig.densityRangeHigh),
        densityRangeLow: parseFloat(renderConfig.densityRangeLow),
        densityRangeSize: parseFloat(renderConfig.densityRangeSize),
      };

      function updateTexture(data: Float32Array): void {
        // texture float value is required to be in range [0.0, 1.0],
        // so we have to convert this in js
        for (let i = 0; i < data.length; i++) {
          let density = Math.min(data[i], param.densityRangeHigh);
          density = Math.max(density, param.densityRangeLow);
          density = density / param.densityRangeSize;
          data[i] = density;
        }
        const tex = new t.DataTexture(data, 64, 64, t.RedFormat, t.FloatType);
        tex.needsUpdate = true;
        shaderMat.uniforms.density.value = tex;
      }
      // calculate the fps
      console.log(`[renderer] [event] Received output, fps: ${data.length}`);
      if (data.length < 30) {
        console.log(
          `[renderer] [event] FPS is low: ${data.length}, interpolation in progress`,
        );
        // interpolate based on current frame rate
        // calc the interplot multiplier
        const interpMul = Math.ceil((30 - 1) / data.length - 1);
        console.log(
          `[renderer] [event] Interpolation multiplier: ${interpMul}`,
        );
        // create the interpolated data
        const interpData: Float32Array[] = [];
        // interpolate
        for (let i = 0; i < data.length; i++) {
          // start with the first original frame, then interpolate interpMul times with linear interpolation,
          // then add the next original frame
          console.log(
            `[renderer] [event] Interpolating frame ${i + 1}/${data.length}`,
          );
          interpData.push(data[i]);
          if (i + 1 < data.length) {
            const start = data[i];
            const end = data[i + 1];
            for (let j = 0; j < interpMul; j++) {
              const interp = new Float32Array(start.length);
              for (let k = 0; k < start.length; k++) {
                interp[k] =
                  start[k] + ((end[k] - start[k]) * (j + 1)) / (interpMul + 1);
              }
              interpData.push(interp);
            }
          }
        }

        console.log(
          `[renderer] [event] Interpolation complete, fps: ${interpData.length}`,
        );
        let i = 0;
        // start the interpolation
        setInterval(
          () => {
            if (i >= interpData.length) return;
            updateTexture(interpData[i]);
            i++;
          },
          1000 / (data.length * interpMul),
        );
      } else {
        let i = 0;
        setInterval(() => {
          if (i >= data.length) return;
          updateTexture(data[i]);
          i++;
        }, 1000 / data.length);
      }
    }
  }, [outputSubs, shaderMat.uniforms.density]);

  const { disableInteraction } = props;
  let pointMoved = false;
  let trackMove = false;
  const prevPointPos = new t.Vector2(0, 0);
  const pointPos = new t.Vector2(0, 0);
  const pointDown = (e: ThreeEvent<PointerEvent>): void => {
    if (e.uv == null) return;
    pointMoved = false;
    trackMove = true;
    // make top left corner (0,0)
    prevPointPos.set(e.uv.x, 1 - e.uv.y);
  };
  const pointMove = (e: ThreeEvent<PointerEvent>): void => {
    if (!trackMove) return;
    if (e.uv == null) return;
    pointMoved = true;
    pointPos.set(e.uv.x, 1 - e.uv.y);
  };
  const pointUp = (_e: ThreeEvent<PointerEvent>): void => {
    pointMoved = false;
    trackMove = false;
  };
  // 30 fps force update for now
  const forceInterval = 1000 / 30;
  // should be in config
  const forceMul = 100;
  // grid size of model, should be changed with config
  const gridSize = new t.Vector2(32, 32);
  setInterval(() => {
    if (disableInteraction) return;
    if (!pointMoved) return;
    const forceDelta = new t.Vector2()
      .subVectors(pointPos, prevPointPos)
      .multiplyScalar(forceMul);
    const loc = new t.Vector2().add(pointPos).multiply(gridSize).round();
    prevPointPos.set(pointPos.x, pointPos.y);
    pointMoved = false;
    console.log('[event] Applying force', forceDelta, 'at', loc);
    // call model with param
    worker.postMessage({
      func: RunnerFunc.UPDATE_FORCE,
      args: {
        forceDelta,
        loc,
      } satisfies UpdateForceArgs,
    });
  }, forceInterval);

  return (
    <mesh
      {...props}
      ref={ref}
      material={shaderMat}
      onPointerUp={pointUp}
      onPointerDown={pointDown}
      onPointerMove={pointMove}
    >
      <planeGeometry args={[10, 8, 31, 31]} />
    </mesh>
  );
}

export { DiffusionPlane, SimulationParams };
