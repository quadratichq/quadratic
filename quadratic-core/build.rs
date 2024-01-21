use std::path::Path;
use std::process::Command;

fn main() {
    println!("Packaging quadratic-py...");
    let package_cmd = Command::new("./package.sh")
        .current_dir(&Path::new("../quadratic-py"))
        .output()
        .expect("Failed to execute quadratic-py packaging process");

    println!("Packaging status: {}", package_cmd.status);
    println!("\nPackaging stdout: \n{}", String::from_utf8_lossy(&package_cmd.stdout));
    println!("\nPackaging stderr: \n{}", String::from_utf8_lossy(&package_cmd.stderr));

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../quadratic-py/");

    assert!(package_cmd.status.success());
}
