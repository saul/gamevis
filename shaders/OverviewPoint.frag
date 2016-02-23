uniform int useTexture;
uniform sampler2D texture1;
uniform vec3 colour;

varying float opacity;
varying vec2 vUv;

void main() {
  gl_FragColor = vec4(colour, opacity);

  if (useTexture != 0) {
    gl_FragColor *= texture2D(texture1, vUv);
  }
}
