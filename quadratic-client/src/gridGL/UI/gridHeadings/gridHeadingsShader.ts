/** Contains the Shader for the Grid Headings Label. */
import { colors } from '@/theme/colors';

const color = colors.gridHeadingLabel;
const r = (color >> 16) / 255;
const g = ((color >> 8) & 0xff) / 255;
const b = (color & 0xff) / 255;

export const msdfFrag = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;

// on 2D applications fwidth is screenScale / glyphAtlasScale * distanceFieldRange
uniform float uFWidth;

void main(void) {

  // To stack MSDF and SDF we need a non-pre-multiplied-alpha texture.
  vec4 texColor = texture2D(uSampler, vTextureCoord);

  // MSDF
  float median = texColor.r + texColor.g + texColor.b -
                  min(texColor.r, min(texColor.g, texColor.b)) -
                  max(texColor.r, max(texColor.g, texColor.b));
  // SDF
  median = min(median, texColor.a);

  float screenPxDistance = uFWidth * (median - 0.5);
  float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
  if (median < 0.01) {
    alpha = 0.0;
  } else if (median > 0.99) {
    alpha = 1.0;
  }

  // NPM Textures, NPM outputs
  gl_FragColor = vec4(${r}, ${g}, ${b}, alpha);
}`;

export const msdfVert = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy;
}`;
