// WebGPU render pipeline for fluid visualization
import renderShader from '../../shaders/wgsl/render.wgsl'
import * as t from 'three'

export interface RenderUniforms {
  uWidth: number
  uHeight: number
  uHeightScale: number
  uLowColor: t.Vector3
  uHighColor: t.Vector3
  projectionMatrix: t.Matrix4
  modelViewMatrix: t.Matrix4
}

export class WebGPURenderPipeline {
  private device: GPUDevice
  private pipeline: GPURenderPipeline
  private uniformBuffer: GPUBuffer
  private vertexBuffer!: GPUBuffer
  private indexBuffer!: GPUBuffer
  private indexCount!: number
  private densityTexture: GPUTexture
  private densitySampler: GPUSampler
  private bindGroup: GPUBindGroup
  private context: GPUCanvasContext
  private format: GPUTextureFormat
  private heightMap: boolean

  constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    format: GPUTextureFormat,
    heightMap: boolean = false,
  ) {
    this.device = device
    this.context = canvas.getContext('webgpu')!
    this.format = format
    this.heightMap = heightMap

    // Configure context
    this.context.configure({
      device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    this.pipeline = this.createPipeline()
    this.createGeometry()

    // Initial texture (will be updated with real data)
    this.densityTexture = this.createDensityTexture()
    this.densitySampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    })

    // Uniform buffer (matrices + params)
    this.uniformBuffer = device.createBuffer({
      size:
        16 + // projectionMatrix (4x4)
        16 + // modelViewMatrix (4x4)
        4 + // uWidth
        4 + // uHeight
        4 + // uHeightScale
        12 + // uLowColor (vec3 + padding)
        12, // uHighColor (vec3 + padding)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.bindGroup = this.createBindGroup()
  }

  private createPipeline(): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      code: renderShader,
    })

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vsMain',
        buffers: [
          {
            // Position buffer
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3',
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsMain',
        targets: [
          {
            format: this.format,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    })
  }

  private createGeometry(): void {
    const width = 10.0
    const height = 8.0

    // Choose segments based on height map mode
    const segmentsX = this.heightMap ? 31 : 1
    const segmentsY = this.heightMap ? 31 : 1

    const vertices: number[] = []
    const indices: number[] = []

    // Generate vertices
    for (let y = 0; y <= segmentsY; y++) {
      for (let x = 0; x <= segmentsX; x++) {
        const u = x / segmentsX
        const v = y / segmentsY
        vertices.push(
          (u - 0.5) * width, // x
          0, // y (will be modified by shader for height map)
          (v - 0.5) * height, // z
        )
      }
    }

    // Generate indices
    for (let y = 0; y < segmentsY; y++) {
      for (let x = 0; x < segmentsX; x++) {
        const i = y * (segmentsX + 1) + x
        indices.push(i, i + segmentsX + 1, i + 1)
        indices.push(i + 1, i + segmentsX + 1, i + segmentsX + 2)
      }
    }

    // Store index count for rendering
    this.indexCount = indices.length

    // Create buffers
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices)
    this.vertexBuffer.unmap()

    this.indexBuffer = this.device.createBuffer({
      size: indices.length * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Uint32Array(this.indexBuffer.getMappedRange()).set(indices)
    this.indexBuffer.unmap()
  }

  private createDensityTexture(): GPUTexture {
    return this.device.createTexture({
      size: [64, 64],
      format: 'r32float',
      usage: GPUBufferUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    })
  }

  private createBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.densityTexture.createView() },
        { binding: 2, resource: this.densitySampler },
      ],
    })
  }

  updateDensity(data: Float32Array): void {
    const textureData = new Float32Array(data)

    // Upload texture data
    this.device.queue.writeTexture(
      { texture: this.densityTexture },
      textureData.buffer,
      { bytesPerRow: 64 * 4, rowsPerImage: 64 },
      { width: 64, height: 64 },
    )
  }

  updateUniforms(uniforms: RenderUniforms): void {
    const uniformData = new Float32Array(36) // 9 vec4s (16*4 + 16*4 + 4*4)

    let offset = 0

    // projectionMatrix
    for (let i = 0; i < 16; i++) {
      uniformData[offset++] = uniforms.projectionMatrix.elements[i]
    }

    // modelViewMatrix
    for (let i = 0; i < 16; i++) {
      uniformData[offset++] = uniforms.modelViewMatrix.elements[i]
    }

    // uWidth
    uniformData[offset++] = uniforms.uWidth

    // uHeight
    uniformData[offset++] = uniforms.uHeight

    // uHeightScale
    uniformData[offset++] = uniforms.uHeightScale
    uniformData[offset++] = 0 // padding

    // uLowColor
    uniformData[offset++] = uniforms.uLowColor.x
    uniformData[offset++] = uniforms.uLowColor.y
    uniformData[offset++] = uniforms.uLowColor.z
    uniformData[offset++] = 0 // padding

    // uHighColor
    uniformData[offset++] = uniforms.uHighColor.x
    uniformData[offset++] = uniforms.uHighColor.y
    uniformData[offset++] = uniforms.uHighColor.z
    uniformData[offset++] = 0 // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
  }

  render(): void {
    const commandEncoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup)
    renderPass.setVertexBuffer(0, this.vertexBuffer)
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32')
    renderPass.drawIndexed(this.indexCount)
    renderPass.end()

    this.device.queue.submit([commandEncoder.finish()])
  }

  resize(): void {
    // Reconfigure context on resize
    // (handled automatically by browser)
  }

  cleanup(): void {
    this.uniformBuffer.destroy()
    this.vertexBuffer.destroy()
    this.indexBuffer.destroy()
    this.densityTexture.destroy()
  }
}
