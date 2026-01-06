import * as t from 'three'

export class SimulationParams {
  // render options
  densityLowColour: t.Color = new t.Color('blue')
  densityHighColour: t.Color = new t.Color('red')

  renderHeightMap: boolean = false
  isCameraControlMode: boolean = false

  // renderer backend: 'webgl' | 'webgpu'
  rendererBackend: 'webgl' | 'webgpu' = 'webgl'
}
