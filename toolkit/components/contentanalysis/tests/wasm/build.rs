//! Generate Rust types from the Content Analysis SDK protobuf contract.
//!
//! Compiles the same `analysis.proto` the C++ backend uses, so the fixture
//! can't drift from the wire format Firefox expects. `protox` is a pure-Rust
//! protobuf compiler, which avoids depending on a system `protoc`.

use std::io::Result;
use std::path::PathBuf;

// third_party/content_analysis_sdk, relative to this crate.
const PROTO_ROOT: &str = "../../../../../third_party/content_analysis_sdk/proto";
const PROTO: &str = "content_analysis/sdk/analysis.proto";

fn main() -> Result<()> {
    println!("cargo::rerun-if-changed={PROTO_ROOT}/{PROTO}");

    let file_descriptors = protox::compile([PROTO], [PROTO_ROOT])
        .expect("failed to compile analysis.proto with protox");

    prost_build::Config::new()
        .file_descriptor_set_path(PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("fds.bin"))
        .compile_fds(file_descriptors)?;

    Ok(())
}
