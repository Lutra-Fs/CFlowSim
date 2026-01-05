uniform sampler2D density;
uniform float uHeightScale;

varying vec2 vUv;

void main() {
  // Use Three.js built-in UV
  vUv = uv;

  // Sample density for height map displacement
  float density = texture2D(density, vUv).r;
  vec3 transformed = position;
  transformed.z += density * uHeightScale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
