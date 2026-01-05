// Compute shader for density normalization on GPU
// Replaces CPU-side normalization for better performance

struct NormalizeParams {
  densityMin: f32,
  densityMax: f32,
  densityRange: f32,
  padding: f32,
};

@group(0) @binding(0) var<storage, read> inputDensity: array<f32>;
@group(0) @binding(1) var<storage, read_write> outputDensity: array<f32>;
@group(0) @binding(2) var<uniform> params: NormalizeParams;

@compute @workgroup_size(64)
fn normalizeDensity(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&inputDensity)) {
    return;
  }

  let value = inputDensity[index];
  let normalized = clamp((value - params.densityMin) / params.densityRange, 0.0, 1.0);
  outputDensity[index] = normalized;
}
