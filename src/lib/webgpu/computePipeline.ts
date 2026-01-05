// Compute shader pipeline for GPU-side density normalization

import { initWebGPU } from './device.js'
import computeShader from '../../shaders/wgsl/compute.wgsl'

export interface NormalizeParams {
  densityMin: number
  densityMax: number
  densityRange: number
}

export class ComputePipeline {
  private device: GPUDevice
  private pipeline: GPUComputePipeline
  private paramsBuffer: GPUBuffer

  constructor(device: GPUDevice) {
    this.device = device
    this.pipeline = this.createPipeline()
    this.paramsBuffer = this.createParamsBuffer()
  }

  private createPipeline(): GPUComputePipeline {
    const shaderModule = this.device.createShaderModule({
      code: computeShader,
    })

    return this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'normalizeDensity',
      },
    })
  }

  private createParamsBuffer(): GPUBuffer {
    // Create uniform buffer for normalization parameters (16 bytes aligned)
    return this.device.createBuffer({
      size: 16, // 4 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  async normalize(input: Float32Array, params: NormalizeParams): Promise<Float32Array> {
    const elementCount = input.length
    const bufferSize = elementCount * 4

    // Create buffers
    const inputBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    const outputBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    })
    const stagingBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })

    // Write input data and parameters
    this.device.queue.writeBuffer(inputBuffer, 0, input.buffer, input.byteOffset, input.byteLength)
    this.device.queue.writeBuffer(
      this.paramsBuffer,
      0,
      new Float32Array([params.densityMin, params.densityMax, params.densityRange, 0])
    )

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    })

    // Encode and submit commands
    const commandEncoder = this.device.createCommandEncoder()
    const passEncoder = commandEncoder.beginComputePass()
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.dispatchWorkgroups(Math.ceil(elementCount / 64))
    passEncoder.end()

    // Copy output to staging buffer
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, bufferSize)

    this.device.queue.submit([commandEncoder.finish()])

    // Read back results
    await stagingBuffer.mapAsync(GPUMapMode.READ)
    const result = new Float32Array(stagingBuffer.getMappedRange().slice(0))
    stagingBuffer.unmap()

    // Cleanup
    inputBuffer.destroy()
    outputBuffer.destroy()
    stagingBuffer.destroy()

    return result
  }

  cleanup(): void {
    this.paramsBuffer.destroy()
  }
}

let cachedPipeline: ComputePipeline | null = null

export async function getComputePipeline(): Promise<ComputePipeline | null> {
  if (cachedPipeline) {
    return cachedPipeline
  }

  try {
    const device = await initWebGPU()
    cachedPipeline = new ComputePipeline(device)
    return cachedPipeline
  } catch {
    return null
  }
}
