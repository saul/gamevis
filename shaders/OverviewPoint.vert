uniform sampler2D texture1;
uniform int fadeOld;
uniform float minTick;
uniform float maxTick;
uniform float opacityScalar;

attribute float tick;

varying float opacity;
varying vec2 vUv;

void main() {
  vUv = uv;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  if (tick < minTick || tick > maxTick) {
    opacity = 0.0;
  } else if (fadeOld != 0) {
    opacity = (tick - minTick) / (maxTick - minTick);
  } else {
    opacity = 1.0;
  }

  opacity *= opacityScalar;
}
