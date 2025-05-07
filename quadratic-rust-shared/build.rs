use std::env;
use std::fs;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let fixtures_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("fixtures");
    let data_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("data");
    let output = format!(
        "pub const FIXTURES_PATH: &str = \"{}\";\npub const DATA_PATH: &str = \"{}\";",
        fixtures_path.display(),
        data_path.display()
    );
    fs::write("src/auto_gen_path.rs", output).expect("Failed to write src/auto_gen_path.rs");

    prost_build::compile_protos(
        &["src/protobuf/proto/transaction.proto"],
        &["src/protobuf/proto/"],
    )?;
    println!("cargo:rerun-if-changed=src/protobuf/proto/transaction.proto");

    Ok(())
}
