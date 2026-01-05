// WebGPU render pipeline for fluid visualization

struct Uniforms {
  uWidth: f32,
  uHeight: f32,
  uHeightScale: f32,
  uLowColor: vec3<f32>,
  uHighColor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var densityTexture: texture_2d<f32>;
@group(0) @binding(2) var densitySampler: sampler;

@vertex
fn vsMain(@location(0) position: vec3<f32>) -> VertexOutput {
  var output: VertexOutput;

  let uv = vec2<f32>(
    (position.x + uniforms.uWidth * 0.5) / uniforms.uWidth,
    (-position.y + uniforms.uHeight * 0.5) / uniforms.uHeight
  );
  // Sample density for height map displacement
  let density = textureSample(densityTexture, densitySampler, uv).r;

  var transformedPos = position;
  transformedPos.z = transformedPos.z + density * uniforms.uHeightScale;

  output.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * vec4<f32>(transformedPos, 1.0);
  output.uv = uv;

  return output;
}

@fragment
fn fsMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Sample density in fragment shader for per-pixel precision
  let densityValue = textureSample(densityTexture, densitySampler, uv).r;
  let normalizedDensity = clamp(densityValue, 0.0, 1.0);
  let color = mix(uniforms.uLowColor, uniforms.uHighColor, normalizedDensity);
  return vec4<f32>(color, 1.0);
}
