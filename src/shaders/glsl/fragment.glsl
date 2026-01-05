uniform sampler2D density;
uniform vec3 uLowColor;
uniform vec3 uHighColor;

varying vec2 vUv;

void main() {
  // Sample density in fragment shader for per-pixel precision
  float densityValue = texture2D(density, vUv).r;
  float normalizedDensity = clamp(densityValue, 0.0, 1.0);
  vec3 color = mix(uLowColor, uHighColor, normalizedDensity);
  gl_FragColor = vec4(color, 1.0);
}
