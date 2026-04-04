use std::{
  env, fs,
  io::{Read, Write},
  path::{Path, PathBuf},
  process::Command,
};

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct SidecarsConfig {
  #[serde(rename = "qdrant")]
  qdrant: SidecarPinned,
  #[serde(rename = "ytDlp")]
  yt_dlp: SidecarPinned,
  #[serde(rename = "ffmpeg")]
  ffmpeg: SidecarPinned,
}

#[derive(Debug, Deserialize)]
struct SidecarPinned {
  repo: String,
  tag: String,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
  assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
  name: String,
  browser_download_url: String,
  digest: Option<String>,
}

pub fn ensure_sidecars() -> anyhow::Result<()> {
  let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?);
  let target = env::var("TARGET")?;

  if target != "x86_64-pc-windows-msvc" && target != "aarch64-pc-windows-msvc" {
    return Err(anyhow::anyhow!(
      "unsupported target (Windows only): {target}"
    ));
  }

  let binaries_dir = manifest_dir.join("bin");
  fs::create_dir_all(&binaries_dir)?;

  let config: SidecarsConfig = {
    let cfg_path = manifest_dir.join("sidecars.json");
    let cfg_bytes = fs::read(&cfg_path)
      .map_err(|e| anyhow::anyhow!("failed reading {}: {e}", cfg_path.display()))?;
    serde_json::from_slice(&cfg_bytes)
      .map_err(|e| anyhow::anyhow!("failed parsing {}: {e}", cfg_path.display()))?
  };

  let root_dir = manifest_dir
    .parent()
    .ok_or_else(|| anyhow::anyhow!("CARGO_MANIFEST_DIR has no parent"))?
    .to_path_buf();

  ensure_faster_whisper(&binaries_dir, &target, &root_dir)?;
  ensure_qdrant(
    &binaries_dir,
    &target,
    &config.qdrant.repo,
    &config.qdrant.tag,
  )?;
  ensure_yt_dlp(
    &binaries_dir,
    &target,
    &config.yt_dlp.repo,
    &config.yt_dlp.tag,
  )?;
  ensure_ffmpeg(
    &binaries_dir,
    &target,
    &config.ffmpeg.repo,
    &config.ffmpeg.tag,
  )?;

  Ok(())
}

fn ensure_faster_whisper(binaries_dir: &Path, target: &str, root_dir: &Path) -> anyhow::Result<()> {
  if target != "x86_64-pc-windows-msvc" {
    return Err(anyhow::anyhow!(
      "unsupported target for faster-whisper sidecar (Windows x86_64 only): {target}"
    ));
  }

  let dest = sidecar_dest_path(binaries_dir, "faster-whisper", target);
  if dest.exists() {
    return Ok(());
  }

  let faster_whisper_dir = root_dir.join("src-asr");
  let venv_python = faster_whisper_dir
    .join(".venv")
    .join("Scripts")
    .join("python.exe");

  if !venv_python.exists() {
    run_cmd(
      Command::new("python")
        .current_dir(&faster_whisper_dir)
        .args(["-m", "venv", ".venv"]),
      "create faster-whisper venv",
    )?;
  }

  let requirements = faster_whisper_dir.join("requirements.txt");
  run_cmd(
    Command::new(&venv_python)
      .current_dir(&faster_whisper_dir)
      .args(["-m", "pip", "install", "-r"])
      .arg(&requirements),
    "install faster-whisper requirements",
  )?;

  run_cmd(
    Command::new(&venv_python)
      .current_dir(&faster_whisper_dir)
      .args([
        "-m",
        "PyInstaller",
        "--onefile",
        "--noconsole",
        "--hidden-import=ctranslate2",
        "--hidden-import=tokenizers",
        "--collect-data",
        "faster_whisper",
        "asr.py",
      ]),
    "pyinstaller faster-whisper",
  )?;

  let built = faster_whisper_dir.join("dist").join("asr.exe");
  if !built.exists() {
    return Err(anyhow::anyhow!(
      "pyinstaller did not produce {}",
      built.display()
    ));
  }

  copy_atomic(&built, &dest)?;

  Ok(())
}

fn ensure_qdrant(binaries_dir: &Path, target: &str, repo: &str, tag: &str) -> anyhow::Result<()> {
  let (asset_name, extracted_name) = match target {
    "x86_64-pc-windows-msvc" => ("qdrant-x86_64-pc-windows-msvc.zip", "qdrant.exe"),
    other => {
      return Err(anyhow::anyhow!(
        "unsupported target for qdrant sidecar (Windows x86_64 only): {other}"
      ));
    }
  };

  let dest = sidecar_dest_path(binaries_dir, "qdrant", target);
  if dest.exists() {
    return Ok(());
  }

  let release = fetch_github_release(repo, tag)?;
  let asset = find_asset(&release, asset_name)?;
  let archive_bytes =
    download_with_sha256_check(&asset.browser_download_url, asset.digest.as_deref())?;
  extract_zip_binary(&archive_bytes, extracted_name, &dest)?;
  Ok(())
}

fn ensure_yt_dlp(binaries_dir: &Path, target: &str, repo: &str, tag: &str) -> anyhow::Result<()> {
  let asset_name = match target {
    "x86_64-pc-windows-msvc" => "yt-dlp.exe",
    "aarch64-pc-windows-msvc" => "yt-dlp_arm64.exe",
    other => {
      return Err(anyhow::anyhow!(
        "unsupported target for yt-dlp sidecar (Windows only): {other}"
      ));
    }
  };

  let dest = sidecar_dest_path(binaries_dir, "yt-dlp", target);
  if dest.exists() {
    return Ok(());
  }

  let release = fetch_github_release(repo, tag)?;
  let asset = find_asset(&release, asset_name)?;
  let bytes = download_with_sha256_check(&asset.browser_download_url, asset.digest.as_deref())?;
  write_atomic(&dest, &bytes)?;
  Ok(())
}

fn ensure_ffmpeg(binaries_dir: &Path, target: &str, repo: &str, tag: &str) -> anyhow::Result<()> {
  let asset_name = match target {
    "x86_64-pc-windows-msvc" => "ffmpeg-master-latest-win64-lgpl.zip",
    other => {
      return Err(anyhow::anyhow!(
        "unsupported target for ffmpeg sidecar (Windows x86_64 only): {other}"
      ));
    }
  };

  let dest_ffmpeg = sidecar_dest_path(binaries_dir, "ffmpeg", target);
  let dest_ffprobe = sidecar_dest_path(binaries_dir, "ffprobe", target);
  if dest_ffmpeg.exists() && dest_ffprobe.exists() {
    return Ok(());
  }

  let release = fetch_github_release(repo, tag)?;
  let asset = find_asset(&release, asset_name)?;
  let archive_bytes =
    download_with_sha256_check(&asset.browser_download_url, asset.digest.as_deref())?;

  if !dest_ffmpeg.exists() {
    extract_zip_binary(&archive_bytes, "ffmpeg.exe", &dest_ffmpeg)?;
  }
  if !dest_ffprobe.exists() {
    extract_zip_binary(&archive_bytes, "ffprobe.exe", &dest_ffprobe)?;
  }

  Ok(())
}

fn sidecar_dest_path(binaries_dir: &Path, base_name: &str, target: &str) -> PathBuf {
  let mut p = binaries_dir.join(format!("{base_name}-{target}"));
  if target.contains("windows") {
    p.set_extension("exe");
  }
  p
}

fn fetch_github_release(repo: &str, tag: &str) -> anyhow::Result<GithubRelease> {
  let url = format!("https://api.github.com/repos/{repo}/releases/tags/{tag}");
  let response = ureq::get(&url)
    .header("User-Agent", "Chechevica App")
    .header("Accept", "application/vnd.github+json")
    .call()
    .map_err(|e| anyhow::anyhow!("GET {url} failed: {e}"))?;

  let mut bytes = Vec::new();
  let (_, body) = response.into_parts();
  body
    .into_reader()
    .read_to_end(&mut bytes)
    .map_err(|e| anyhow::anyhow!("reading response from {url} failed: {e}"))?;
  let release: GithubRelease = serde_json::from_slice(&bytes)
    .map_err(|e| anyhow::anyhow!("parsing github release json from {url} failed: {e}"))?;
  Ok(release)
}

fn find_asset<'a>(release: &'a GithubRelease, name: &str) -> anyhow::Result<&'a GithubAsset> {
  release
    .assets
    .iter()
    .find(|a| a.name == name)
    .ok_or_else(|| anyhow::anyhow!("release asset not found: {name}"))
}

fn download_with_sha256_check(url: &str, digest: Option<&str>) -> anyhow::Result<Vec<u8>> {
  let response = ureq::get(url)
    .header("User-Agent", "Chechevica App")
    .call()
    .map_err(|e| anyhow::anyhow!("GET {url} failed: {e}"))?;

  let mut bytes = Vec::new();
  let (_, body) = response.into_parts();
  body
    .into_reader()
    .read_to_end(&mut bytes)
    .map_err(|e| anyhow::anyhow!("reading body from {url} failed: {e}"))?;

  if let Some(digest) = digest {
    // GitHub returns e.g. "sha256:deadbeef..."
    if let Some(expected) = digest.strip_prefix("sha256:") {
      let actual = sha256_hex(&bytes);
      if !eq_hex_case_insensitive(&actual, expected) {
        return Err(anyhow::anyhow!(
          "sha256 mismatch for {url}: expected {expected}, got {actual}"
        ));
      }
    }
  }

  Ok(bytes)
}

fn extract_zip_binary(
  archive_bytes: &[u8],
  extracted_name: &str,
  dest: &Path,
) -> anyhow::Result<()> {
  let reader = std::io::Cursor::new(archive_bytes);
  let mut zip =
    zip::ZipArchive::new(reader).map_err(|e| anyhow::anyhow!("failed reading zip: {e}"))?;

  for i in 0..zip.len() {
    let mut file = zip
      .by_index(i)
      .map_err(|e| anyhow::anyhow!("failed reading zip entry: {e}"))?;
    let name = file.name().replace('\\', "/");
    if name.ends_with(extracted_name) {
      let mut out = Vec::new();
      file.read_to_end(&mut out)?;
      write_atomic(dest, &out)?;
      return Ok(());
    }
  }
  Err(anyhow::anyhow!(
    "did not find {extracted_name} in zip archive"
  ))
}

fn write_atomic(path: &Path, contents: &[u8]) -> anyhow::Result<()> {
  let parent = path
    .parent()
    .ok_or_else(|| anyhow::anyhow!("path has no parent: {}", path.display()))?;
  fs::create_dir_all(parent)?;

  let tmp = parent.join(format!(
    ".{}.tmp",
    path.file_name().unwrap_or_default().to_string_lossy()
  ));

  {
    let mut f = fs::File::create(&tmp)?;
    f.write_all(contents)?;
    f.sync_all()?;
  }

  // On Windows, rename over existing can fail; we only use this for fresh writes
  if path.exists() {
    fs::remove_file(path)?;
  }
  fs::rename(&tmp, path)?;
  Ok(())
}

fn copy_atomic(src: &Path, dest: &Path) -> anyhow::Result<()> {
  let parent = dest
    .parent()
    .ok_or_else(|| anyhow::anyhow!("path has no parent: {}", dest.display()))?;
  fs::create_dir_all(parent)?;

  let tmp = parent.join(format!(
    ".{}.tmp",
    dest.file_name().unwrap_or_default().to_string_lossy()
  ));
  if tmp.exists() {
    fs::remove_file(&tmp)?;
  }

  fs::copy(src, &tmp)
    .map_err(|e| anyhow::anyhow!("copy {} -> {} failed: {e}", src.display(), tmp.display()))?;

  if dest.exists() {
    fs::remove_file(dest)?;
  }
  fs::rename(&tmp, dest)?;
  Ok(())
}

fn run_cmd(cmd: &mut Command, what: &str) -> anyhow::Result<()> {
  let output = cmd
    .output()
    .map_err(|e| anyhow::anyhow!("failed to run {what}: {e}"))?;
  if output.status.success() {
    return Ok(());
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  Err(anyhow::anyhow!(
    "{what} failed (exit {}):\nstdout:\n{stdout}\nstderr:\n{stderr}",
    output.status
  ))
}

fn sha256_hex(bytes: &[u8]) -> String {
  use sha2::{Digest, Sha256};
  let mut hasher = Sha256::new();
  hasher.update(bytes);
  let result = hasher.finalize();
  hex::encode(result)
}

fn eq_hex_case_insensitive(a: &str, b: &str) -> bool {
  a.len() == b.len()
    && a
      .bytes()
      .zip(b.bytes())
      .all(|(a, b)| a.eq_ignore_ascii_case(&b))
}
