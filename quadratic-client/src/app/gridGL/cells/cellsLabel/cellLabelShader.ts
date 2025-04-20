/** Contains the Shader for a non-tinted MSDF font (which requires less data than the tinted version). */

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
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}`;

export const msdfVert = `
attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;

varying vec2 vTextureCoord;

void main(@location(1) aUV: vec2<f32>, ) {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = (uTextureMatrix * vec3(aUV, 1.0)).xy;
}`;

// WebGPU shaders
export const wgsl = `
struct GlobalUniforms {
  uProjectionMatrix:mat3x3<f32>,
  uWorldTransformMatrix:mat3x3<f32>,
};

struct LocalUniforms {
    uFWidth: f32,
};

@group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
    @location(0) textureCoord: vec2<f32>,
};

@vertex
fn mainVertex(@location(0) aPosition : vec2<f32>, @location(1) aUV : vec2<f32>, ) -> VertexOutput {
    var output: VertexOutput;

    // Calculate position using the transformation matrices
    let pos = globalUniforms.uProjectionMatrix * globalUniforms.uWorldTransformMatrix * vec3<f32>(aPosition, 1.0);
    output.position = vec4<f32>(pos.xy, 0.0, 1.0);

    // Pass through texture coordinates
    output.textureCoord = aUV;

    return output;
}

@group(2) @binding(1) var uTexture: texture_2d<f32>;
@group(2) @binding(2) var uSampler: sampler;

@fragment
fn mainFrag(@location(0) aUV: vec2<f32>, ) -> @location(0) vec4<f32> {
    // Sample the texture
    let texColor = textureSample(uTexture, uSampler, aUV);

    // MSDF calculation
    let median = texColor.r + texColor.g + texColor.b -
                 min(texColor.r, min(texColor.g, texColor.b)) -
                 max(texColor.r, max(texColor.g, texColor.b));

    // SDF calculation
    let combinedMedian = min(median, texColor.a);
    let screenPxDistance = localUniforms.uFWidth * (combinedMedian - 0.5);
    var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    if (combinedMedian < 0.01) {
        alpha = 0.0;
    } else if (combinedMedian > 0.99) {
        alpha = 1.0;
    }

    // Return the final color with alpha
    return vec4<f32>(0.0, 0.0, 0.0, alpha);
}`;
