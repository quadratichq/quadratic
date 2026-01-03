//! Console logger for WASM - logs to browser console
//!
//! Shared between layout and render workers.

use log::{Level, Log, Metadata, Record};

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn warn(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn debug(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn info(s: &str);
}

/// Console logger that outputs to browser console
pub struct ConsoleLogger {
    /// Optional prefix for log messages (e.g., "layout", "render")
    prefix: Option<&'static str>,
}

impl ConsoleLogger {
    /// Create a new console logger without a prefix
    pub const fn new() -> Self {
        Self { prefix: None }
    }

    /// Create a new console logger with a prefix
    pub const fn with_prefix(prefix: &'static str) -> Self {
        Self {
            prefix: Some(prefix),
        }
    }
}

/// Default console logger (no prefix)
pub static CONSOLE_LOGGER: ConsoleLogger = ConsoleLogger::new();

/// Layout worker logger
pub static LAYOUT_LOGGER: ConsoleLogger = ConsoleLogger::with_prefix("layout");

/// Render worker logger
pub static RENDER_LOGGER: ConsoleLogger = ConsoleLogger::with_prefix("render");

impl Log for ConsoleLogger {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        metadata.level() <= Level::Debug
    }

    fn log(&self, record: &Record<'_>) {
        if self.enabled(record.metadata()) {
            let msg = match self.prefix {
                Some(prefix) => format!(
                    "[{}] [{}] {} - {}",
                    prefix,
                    record.level(),
                    record.target(),
                    record.args()
                ),
                None => format!(
                    "[{}] {} - {}",
                    record.level(),
                    record.target(),
                    record.args()
                ),
            };

            #[cfg(feature = "wasm")]
            {
                match record.level() {
                    Level::Error => error(&msg),
                    Level::Warn => warn(&msg),
                    Level::Info => info(&msg),
                    Level::Debug => debug(&msg),
                    Level::Trace => log(&msg),
                }
            }

            #[cfg(not(feature = "wasm"))]
            {
                eprintln!("{}", msg);
            }
        }
    }

    fn flush(&self) {}
}
