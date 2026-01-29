use crate::{controller::GridController, grid::ConnectionKind};

impl GridController {
    pub fn with_run_python_callback<F>(&mut self, f: F)
    where
        F: FnMut(String, i32, i32, String, String, f32, f32) + Send + 'static,
    {
        self.run_python_callback = Some(Box::new(f));
    }

    pub fn with_run_javascript_callback<F>(&mut self, f: F)
    where
        F: FnMut(String, i32, i32, String, String) + Send + 'static,
    {
        self.run_javascript_callback = Some(Box::new(f));
    }

    pub fn with_run_connection_callback<F>(&mut self, f: F)
    where
        F: FnMut(String, i32, i32, String, String, ConnectionKind, String) + Send + 'static,
    {
        self.run_connection_callback = Some(Box::new(f));
    }
}
