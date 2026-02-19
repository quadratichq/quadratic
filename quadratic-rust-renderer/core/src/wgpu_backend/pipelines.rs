//! Render pipelines for wgpu

use wgpu::util::DeviceExt;
use wgpu::*;

use super::shaders;

/// Render pipelines for different draw types
pub struct RenderPipelines {
    triangle_pipeline: RenderPipeline,
    line_pipeline: RenderPipeline,
    text_pipeline: RenderPipeline,
    sprite_pipeline: RenderPipeline,

    // Bind group layouts
    matrix_bind_group_layout: BindGroupLayout,
    text_bind_group_layout: BindGroupLayout,

    // Samplers
    linear_sampler: Sampler,
}

impl RenderPipelines {
    pub fn new(device: &Device, target_format: TextureFormat) -> Self {
        // Create shader modules
        let triangle_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Triangle Shader"),
            source: ShaderSource::Wgsl(shaders::TRIANGLE_SHADER.into()),
        });

        let line_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Line Shader"),
            source: ShaderSource::Wgsl(shaders::LINE_SHADER.into()),
        });

        let text_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Text Shader"),
            source: ShaderSource::Wgsl(shaders::TEXT_SHADER.into()),
        });

        let sprite_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Sprite Shader"),
            source: ShaderSource::Wgsl(shaders::SPRITE_SHADER.into()),
        });

        // Bind group layouts
        let matrix_bind_group_layout =
            device.create_bind_group_layout(&BindGroupLayoutDescriptor {
                label: Some("Matrix Bind Group Layout"),
                entries: &[BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::VERTEX,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });

        let text_bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Text Bind Group Layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        // Sampler
        let linear_sampler = device.create_sampler(&SamplerDescriptor {
            label: Some("Linear Sampler"),
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            mipmap_filter: FilterMode::Linear,
            ..Default::default()
        });

        // Vertex buffer layout for triangles/lines (position + color)
        let vertex_layout = VertexBufferLayout {
            array_stride: 6 * 4, // 6 floats: x, y, r, g, b, a
            step_mode: VertexStepMode::Vertex,
            attributes: &[
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 0,
                    shader_location: 0,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x4,
                    offset: 8,
                    shader_location: 1,
                },
            ],
        };

        // Vertex buffer layout for text (position + uv + color)
        let text_vertex_layout = VertexBufferLayout {
            array_stride: 8 * 4, // 8 floats: x, y, u, v, r, g, b, a
            step_mode: VertexStepMode::Vertex,
            attributes: &[
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 0,
                    shader_location: 0,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 8,
                    shader_location: 1,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x4,
                    offset: 16,
                    shader_location: 2,
                },
            ],
        };

        // Create pipelines
        let triangle_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Triangle Pipeline Layout"),
            bind_group_layouts: &[&matrix_bind_group_layout],
            push_constant_ranges: &[],
        });

        let triangle_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Triangle Pipeline"),
            layout: Some(&triangle_pipeline_layout),
            vertex: VertexState {
                module: &triangle_shader,
                entry_point: Some("vs_main"),
                buffers: std::slice::from_ref(&vertex_layout),
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &triangle_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let line_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Line Pipeline"),
            layout: Some(&triangle_pipeline_layout),
            vertex: VertexState {
                module: &line_shader,
                entry_point: Some("vs_main"),
                buffers: &[vertex_layout],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &line_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::LineList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let text_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Text Pipeline Layout"),
            bind_group_layouts: &[&text_bind_group_layout],
            push_constant_ranges: &[],
        });

        let text_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Text Pipeline"),
            layout: Some(&text_pipeline_layout),
            vertex: VertexState {
                module: &text_shader,
                entry_point: Some("vs_main"),
                buffers: std::slice::from_ref(&text_vertex_layout),
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &text_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let sprite_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Sprite Pipeline"),
            layout: Some(&text_pipeline_layout),
            vertex: VertexState {
                module: &sprite_shader,
                entry_point: Some("vs_main"),
                buffers: &[text_vertex_layout],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &sprite_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        Self {
            triangle_pipeline,
            line_pipeline,
            text_pipeline,
            sprite_pipeline,
            matrix_bind_group_layout,
            text_bind_group_layout,
            linear_sampler,
        }
    }

    pub fn draw_triangles<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Triangle Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let matrix_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Matrix Buffer"),
            contents: bytemuck::cast_slice(matrix),
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Matrix Bind Group"),
            layout: &self.matrix_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: matrix_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.triangle_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.draw(0..(vertices.len() / 6) as u32, 0..1);
    }

    pub fn draw_lines<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Line Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let matrix_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Matrix Buffer"),
            contents: bytemuck::cast_slice(matrix),
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Matrix Bind Group"),
            layout: &self.matrix_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: matrix_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.line_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.draw(0..(vertices.len() / 6) as u32, 0..1);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn draw_text<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        indices: &[u32],
        texture_view: &'a TextureView,
        matrix: &[f32; 16],
        scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Index Buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: BufferUsages::INDEX,
        });

        // Uniforms: matrix (64 bytes) + scale, font_scale, distance_range, padding (16 bytes)
        let mut uniform_data = [0u8; 80];
        uniform_data[..64].copy_from_slice(bytemuck::cast_slice(matrix));
        uniform_data[64..68].copy_from_slice(&scale.to_le_bytes());
        uniform_data[68..72].copy_from_slice(&font_scale.to_le_bytes());
        uniform_data[72..76].copy_from_slice(&distance_range.to_le_bytes());

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Uniform Buffer"),
            contents: &uniform_data,
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Text Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(texture_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.text_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn draw_sprites<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        indices: &[u32],
        texture_view: &'a TextureView,
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Index Buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: BufferUsages::INDEX,
        });

        // Uniforms: just matrix for sprites
        let mut uniform_data = [0u8; 80];
        uniform_data[..64].copy_from_slice(bytemuck::cast_slice(matrix));

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Uniform Buffer"),
            contents: &uniform_data,
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Sprite Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(texture_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.sprite_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }
}

#[cfg(all(test, feature = "wgpu"))]
mod tests {
    use super::*;
    use wgpu::{Backends, Instance, InstanceDescriptor, PowerPreference, RequestAdapterOptions};

    /// Create a test wgpu device and queue for testing
    fn create_test_device() -> (Device, Queue) {
        let instance = Instance::new(InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        // Try to get a GPU adapter first, fall back to CPU if not available
        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
        .or_else(|| {
            pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
                power_preference: PowerPreference::LowPower,
                compatible_surface: None,
                force_fallback_adapter: true,
            }))
        })
        .expect("Failed to get adapter (no GPU or CPU adapter available)");

        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("Test Device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                memory_hints: wgpu::MemoryHints::default(),
            },
            None,
        ))
        .expect("Failed to create device");

        (device, queue)
    }

    #[test]
    fn test_render_pipelines_new() {
        let (device, _queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;

        let _pipelines = RenderPipelines::new(&device, format);

    }

    #[test]
    fn test_render_pipelines_different_formats() {
        let (device, _queue) = create_test_device();

        // Test with different texture formats
        let formats = [
            TextureFormat::Rgba8Unorm,
            TextureFormat::Bgra8Unorm,
            TextureFormat::Rgba8UnormSrgb,
        ];

        for format in formats.iter() {
            let _pipelines = RenderPipelines::new(&device, *format);
        }
    }

    #[test]
    fn test_draw_triangles_creates_buffers() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        // Create a test render pass
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Test Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        // Test with valid triangle vertices (x, y, r, g, b, a) * 3 vertices = 18 floats
        let vertices = [
            0.0, 0.0, 1.0, 0.0, 0.0, 1.0, // vertex 1: red
            50.0, 0.0, 0.0, 1.0, 0.0, 1.0, // vertex 2: green
            25.0, 50.0, 0.0, 0.0, 1.0, 1.0, // vertex 3: blue
        ];

        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        pipelines.draw_triangles(&mut render_pass, &device, &queue, &vertices, &matrix);

        drop(render_pass);
    }

    #[test]
    fn test_draw_triangles_empty_vertices() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Test Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let vertices = [];
        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        // Should handle empty vertices gracefully (draws 0 vertices)
        pipelines.draw_triangles(&mut render_pass, &device, &queue, &vertices, &matrix);

        drop(render_pass);
    }

    #[test]
    fn test_draw_lines_creates_buffers() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Test Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        // Test with valid line vertices (x, y, r, g, b, a) * 2 vertices = 12 floats
        let vertices = [
            0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 1: white
            100.0, 100.0, 0.0, 0.0, 0.0, 1.0, // vertex 2: black
        ];

        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        pipelines.draw_lines(&mut render_pass, &device, &queue, &vertices, &matrix);

        drop(render_pass);
    }

    #[test]
    fn test_draw_text_creates_buffers() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        // Create a texture for the text
        let text_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Text Texture"),
            size: wgpu::Extent3d {
                width: 256,
                height: 256,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });

        let text_view = text_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let render_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Render Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let render_view = render_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &render_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        // Test with valid text vertices (x, y, u, v, r, g, b, a) * 4 vertices = 32 floats
        let vertices = [
            0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 1
            50.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 2
            50.0, 50.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, // vertex 3
            0.0, 50.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, // vertex 4
        ];

        let indices = [0, 1, 2, 0, 2, 3]; // Two triangles forming a quad

        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        pipelines.draw_text(
            &mut render_pass,
            &device,
            &queue,
            &vertices,
            &indices,
            &text_view,
            &matrix,
            1.0,
            1.0,
            0.5,
        );

        drop(render_pass);
    }

    #[test]
    fn test_draw_sprites_creates_buffers() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        // Create a sprite texture
        let sprite_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Sprite Texture"),
            size: wgpu::Extent3d {
                width: 64,
                height: 64,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });

        let sprite_view = sprite_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let render_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Render Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let render_view = render_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &render_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        // Test with valid sprite vertices (x, y, u, v, r, g, b, a) * 4 vertices = 32 floats
        let vertices = [
            0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 1
            32.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 2
            32.0, 32.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, // vertex 3
            0.0, 32.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, // vertex 4
        ];

        let indices = [0, 1, 2, 0, 2, 3]; // Two triangles forming a quad

        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        pipelines.draw_sprites(
            &mut render_pass,
            &device,
            &queue,
            &vertices,
            &indices,
            &sprite_view,
            &matrix,
        );

        drop(render_pass);
    }

    #[test]
    fn test_draw_text_uniform_data() {
        let (device, queue) = create_test_device();
        let format = TextureFormat::Rgba8Unorm;
        let pipelines = RenderPipelines::new(&device, format);

        let text_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Text Texture"),
            size: wgpu::Extent3d {
                width: 256,
                height: 256,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });

        let text_view = text_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let render_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Render Texture"),
            size: wgpu::Extent3d {
                width: 100,
                height: 100,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let render_view = render_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Test Encoder"),
        });

        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Test Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &render_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let vertices = [
            0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 50.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 50.0,
            50.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 50.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        ];

        let indices = [0, 1, 2, 0, 2, 3];

        let matrix = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        // Test with different scale values
        pipelines.draw_text(
            &mut render_pass,
            &device,
            &queue,
            &vertices,
            &indices,
            &text_view,
            &matrix,
            2.0,
            1.5,
            0.25,
        );

        drop(render_pass);
    }
}
