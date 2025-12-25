//! Console logger for WASM - logs to browser console

use log::{Level, Log, Metadata, Record};
use wasm_bindgen::prelude::*;

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
pub struct ConsoleLogger;

pub static CONSOLE_LOGGER: ConsoleLogger = ConsoleLogger;

impl Log for ConsoleLogger {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        metadata.level() <= Level::Debug
    }

    fn log(&self, record: &Record<'_>) {
        if self.enabled(record.metadata()) {
            let msg = format!(
                "[{}] {} - {}",
                record.level(),
                record.target(),
                record.args()
            );

            match record.level() {
                Level::Error => error(&msg),
                Level::Warn => warn(&msg),
                Level::Info => info(&msg),
                Level::Debug => debug(&msg),
                Level::Trace => log(&msg),
            }
        }
    }

    fn flush(&self) {}
}

