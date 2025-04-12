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

// WebGPU shaders
export const msdfFragWGSL = `
// WebGPU MSDF Fragment Shader
// Based on the original WebGL MSDF shader

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) textureCoord: vec2<f32>,
};

@group(0) @binding(0) var uSampler: sampler;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uFWidth: f32;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the texture
    let texColor = textureSample(uTexture, uSampler, input.textureCoord);

    // MSDF calculation
    let median = texColor.r + texColor.g + texColor.b -
                 min(texColor.r, min(texColor.g, texColor.b)) -
                 max(texColor.r, max(texColor.g, texColor.b));

    // SDF calculation
    let combinedMedian = min(median, texColor.a);

    let screenPxDistance = uFWidth * (combinedMedian - 0.5);
    var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    if (combinedMedian < 0.01) {
        alpha = 0.0;
    } else if (combinedMedian > 0.99) {
        alpha = 1.0;
    }

    // Return the final color with alpha
    return vec4<f32>(0.0, 0.0, 0.0, alpha);
}`;

export const msdfVertWGSL = `
// WebGPU MSDF Vertex Shader
// Based on the original WebGL MSDF vertex shader

struct VertexInput {
    @location(0) aVertexPosition: vec2<f32>,
    @location(1) aTextureCoord: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) textureCoord: vec2<f32>,
};

struct Uniforms {
    projectionMatrix: mat3x3<f32>,
    translationMatrix: mat3x3<f32>,
    textureMatrix: mat3x3<f32>,
};

@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Calculate position
    let pos = uniforms.projectionMatrix * uniforms.translationMatrix * vec3<f32>(input.aVertexPosition, 1.0);
    output.position = vec4<f32>(pos.xy, 0.0, 1.0);

    // Calculate texture coordinates
    output.textureCoord = (uniforms.textureMatrix * vec3<f32>(input.aTextureCoord, 1.0)).xy;

    return output;
}`;
