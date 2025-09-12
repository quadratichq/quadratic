use std::env;
use std::fs;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(feature = "test") {
        let fixtures_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("fixtures");
        let data_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("data");
        let output = format!(
            "pub const FIXTURES_PATH: &str = \"{}\";\npub const DATA_PATH: &str = \"{}\";",
            fixtures_path.display(),
            data_path.display()
        );
        fs::write("src/auto_gen_path.rs", output).expect("Failed to write src/auto_gen_path.rs");
    }

    if cfg!(feature = "protobuf") {
        // Configure prost_reflect_build
        let mut builder = prost_reflect_build::Builder::new();
        builder.file_descriptor_set_bytes("crate::protobuf::FILE_DESCRIPTOR_SET_BYTES");

        builder.compile_protos(
            &["src/protobuf/proto/transaction.proto"],
            &["src/protobuf/proto/"],
        )?;

        // Post-process the generated file to add the desired import and fix references
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
        let generated_file = out_dir.join("quadratic.rs");

        if generated_file.exists() {
            let content = fs::read_to_string(&generated_file)?;
            // Add the import and replace ::prost_types:: with prost_types::
            let modified_content = format!(
                "use prost_reflect::prost_types;\n{}",
                content.replace("::prost_types::", "prost_types::")
            );
            fs::write(&generated_file, modified_content)?;
        }

        println!("cargo:rerun-if-changed=src/protobuf/proto/transaction.proto");
    }

    Ok(())
}
