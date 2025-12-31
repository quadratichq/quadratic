use wasm_bindgen::JsValue;
use web_sys::{WebGl2RenderingContext, WebGlProgram, WebGlShader};

use super::WebGLContext;

impl WebGLContext {
    /// Compile a shader
    pub(crate) fn compile_shader(
        gl: &WebGl2RenderingContext,
        shader_type: u32,
        source: &str,
    ) -> Result<WebGlShader, JsValue> {
        let shader = gl
            .create_shader(shader_type)
            .ok_or("Failed to create shader")?;

        gl.shader_source(&shader, source);
        gl.compile_shader(&shader);

        if gl
            .get_shader_parameter(&shader, WebGl2RenderingContext::COMPILE_STATUS)
            .as_bool()
            .unwrap_or(false)
        {
            Ok(shader)
        } else {
            let log = gl.get_shader_info_log(&shader).unwrap_or_default();
            gl.delete_shader(Some(&shader));
            Err(JsValue::from_str(&format!(
                "Shader compilation failed: {}",
                log
            )))
        }
    }

    /// Create and link a shader program
    pub(crate) fn create_program(
        gl: &WebGl2RenderingContext,
        vertex_source: &str,
        fragment_source: &str,
    ) -> Result<WebGlProgram, JsValue> {
        let vertex_shader =
            Self::compile_shader(gl, WebGl2RenderingContext::VERTEX_SHADER, vertex_source)?;
        let fragment_shader =
            Self::compile_shader(gl, WebGl2RenderingContext::FRAGMENT_SHADER, fragment_source)?;

        let program = gl.create_program().ok_or("Failed to create program")?;

        gl.attach_shader(&program, &vertex_shader);
        gl.attach_shader(&program, &fragment_shader);
        gl.link_program(&program);

        // Clean up shaders (they're now part of the program)
        gl.delete_shader(Some(&vertex_shader));
        gl.delete_shader(Some(&fragment_shader));

        if gl
            .get_program_parameter(&program, WebGl2RenderingContext::LINK_STATUS)
            .as_bool()
            .unwrap_or(false)
        {
            Ok(program)
        } else {
            let log = gl.get_program_info_log(&program).unwrap_or_default();
            gl.delete_program(Some(&program));
            Err(JsValue::from_str(&format!(
                "Program linking failed: {}",
                log
            )))
        }
    }
}
