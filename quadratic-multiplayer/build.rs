use std::env;
use std::fs;
use std::path::Path;

static MIN_VERSION: &str = "updateAlertVersion.json";

fn main() {
    let out_dir = env::var_os("CARGO_MANIFEST_DIR").unwrap();
    let source_path = Path::new(&out_dir).parent().unwrap().join(MIN_VERSION);
    let dest_path = Path::new(&out_dir).join(MIN_VERSION);
    fs::copy(source_path, dest_path).unwrap();

    println!("cargo:rerun-if-changed=build.rs");
}
