#[path = "build/sidecars.rs"]
mod sidecars;

fn main() {
  sidecars::ensure_sidecars().expect("Failed to ensure sidecar binaries");
  tauri_build::build()
}
