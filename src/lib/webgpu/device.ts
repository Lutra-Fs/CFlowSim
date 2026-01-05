// WebGPU device initialization and management

let cachedDevice: GPUDevice | null = null

export async function initWebGPU(): Promise<GPUDevice> {
  if (cachedDevice) {
    return cachedDevice
  }

  if (!navigator.gpu) {
    throw new Error('WebGPU not supported in this browser')
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('No GPU adapter found')
  }

  cachedDevice = await adapter.requestDevice()
  return cachedDevice
}

export function getWebGPUDevice(): GPUDevice | null {
  return cachedDevice
}

export async function isWebGPUAvailable(): Promise<boolean> {
  if (!navigator.gpu) {
    return false
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}
