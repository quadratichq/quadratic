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

    // Create a prost_build Config
    let mut config = prost_build::Config::new();

    // Set the file descriptor set output path
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let file_descriptor_set_path = out_dir.join("file_descriptor_set.bin");
    config.file_descriptor_set_path(&file_descriptor_set_path);

    // Generate the file descriptor set and compile the protos
    config.compile_protos(
        &["src/protobuf/proto/transaction.proto"],
        &["src/protobuf/proto/"],
    )?;

    // Configure prost_reflect_build with the file descriptor set path
    // let file_descriptor_set_bytes = fs::read(&file_descriptor_set_path).unwrap();
    prost_reflect_build::Builder::new()
        .file_descriptor_set_bytes("crate::protobuf::FILE_DESCRIPTOR_SET_BYTES")
        // .file_descriptor_set_path(&file_descriptor_set_path)
        .compile_protos(
            &["src/protobuf/proto/transaction.proto"],
            &["src/protobuf/proto/"],
        )?;

    println!("cargo:rerun-if-changed=src/protobuf/proto/transaction.proto");

    Ok(())
}
