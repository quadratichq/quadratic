//! MSDF text shader

/// MSDF text vertex shader
/// Handles position, texture coordinates, and optional color
pub const MSDF_VERTEX_SHADER: &str = r#"#version 300 es
precision highp float;

// Vertex attributes
in vec2 a_position;
in vec2 a_texcoord;
in vec4 a_color;

// Uniforms
uniform mat4 u_matrix;

// Varyings
out vec2 v_texcoord;
out vec4 v_color;

void main() {
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
    v_color = a_color;
}
"#;

/// MSDF text fragment shader
/// Implements multi-channel signed distance field rendering
pub const MSDF_FRAGMENT_SHADER: &str = r#"#version 300 es
precision highp float;

in vec2 v_texcoord;
in vec4 v_color;

uniform sampler2D u_texture;
uniform float u_fwidth;

out vec4 fragColor;

void main() {
    // Sample the MSDF texture
    vec4 texColor = texture(u_texture, v_texcoord);

    // MSDF: Calculate median of RGB channels
    float median = texColor.r + texColor.g + texColor.b -
                   min(texColor.r, min(texColor.g, texColor.b)) -
                   max(texColor.r, max(texColor.g, texColor.b));

    // SDF fallback: use alpha channel
    median = min(median, texColor.a);

    // Calculate screen-space distance
    float screenPxDistance = u_fwidth * (median - 0.5);
    float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    // Clean up edges
    if (median < 0.01) {
        alpha = 0.0;
    } else if (median > 0.99) {
        alpha = 1.0;
    }

    // Output with color
    fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
"#;
