use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let fixtures_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("fixtures");
    let data_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("data");
    let output = format!(
        "const FIXTURES_PATH: &str = \"{}\";\nconst DATA_PATH: &str = \"{}\";",
        fixtures_path.display(),
        data_path.display()
    );
    fs::write("src/auto_gen_path.rs", output).expect("Failed to write src/auto_gen_path.rs");
}
