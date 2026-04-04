use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};

use anyhow::Context;
use colored::Colorize;
use tauri::{AppHandle, async_runtime::channel};
use tauri_plugin_shell::{
  ShellExt,
  process::{CommandChild, CommandEvent},
};

#[cfg(windows)]
use std::{os::windows::process::CommandExt, process::Command};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

use crate::infra::sidecars::structs::{SidecarId, SidecarKind, SidecarOptions, SidecarTransport};

pub struct SidecarRuntime {
  handle: AppHandle,
  running_sidecars: Arc<Mutex<HashMap<SidecarId, RunningSidecar>>>,
}

struct RunningSidecar {
  kind: SidecarKind,
  child: Arc<Mutex<Option<CommandChild>>>,
}

impl SidecarRuntime {
  pub fn new(handle: AppHandle) -> Self {
    Self {
      handle,
      running_sidecars: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  pub async fn run(
    &self,
    kind: SidecarKind,
    options: SidecarOptions,
  ) -> anyhow::Result<SidecarTransport> {
    let mut command = self
      .handle
      .shell()
      .sidecar(kind.to_string())
      .with_context(|| format!("sidecar '{}' not configured", kind))?
      .args(options.args);

    if let Some(cwd) = options.cwd {
      command = command.current_dir(cwd);
    }

    self.spawn_transport(kind, command.spawn()?)
  }

  pub fn shutdown(&self, id: SidecarId) -> anyhow::Result<()> {
    let sidecar = self
      .running_sidecars
      .lock()
      .map_err(|_| anyhow::anyhow!("running sidecars mutex poisoned"))?
      .remove(&id);

    if let Some(sidecar) = sidecar {
      Self::terminate_sidecar_process(sidecar.kind, sidecar.child)?;
    }

    Ok(())
  }

  pub fn complete(&self, id: SidecarId) -> anyhow::Result<()> {
    self
      .running_sidecars
      .lock()
      .map_err(|_| anyhow::anyhow!("running sidecars mutex poisoned"))?
      .remove(&id);

    Ok(())
  }

  pub fn shutdown_all(&self) -> anyhow::Result<()> {
    let sidecars: Vec<_> = self
      .running_sidecars
      .lock()
      .map_err(|_| anyhow::anyhow!("running sidecars mutex poisoned"))?
      .drain()
      .map(|(_, sidecar)| sidecar)
      .collect();

    for sidecar in sidecars {
      Self::terminate_sidecar_process(sidecar.kind, sidecar.child)?;
    }

    Ok(())
  }

  fn spawn_transport(
    &self,
    kind: SidecarKind,
    (mut events, child): (tauri::async_runtime::Receiver<CommandEvent>, CommandChild),
  ) -> anyhow::Result<SidecarTransport> {
    let id = SidecarId::new();
    let child = Arc::new(Mutex::new(Some(child)));
    let running_sidecars = self.running_sidecars.clone();

    self
      .running_sidecars
      .lock()
      .map_err(|_| anyhow::anyhow!("running sidecars mutex poisoned"))?
      .insert(
        id,
        RunningSidecar {
          kind,
          child: child.clone(),
        },
      );

    let (stdin_tx, mut stdin_rx) = channel::<Vec<u8>>(64);
    let stdin_child = child.clone();
    tauri::async_runtime::spawn(async move {
      while let Some(input) = stdin_rx.recv().await {
        let mut child_guard = match stdin_child.lock() {
          Ok(guard) => guard,
          Err(_) => break,
        };

        let Some(process) = child_guard.as_mut() else {
          break;
        };

        if process.write(&input).is_err() {
          break;
        }
      }
    });

    let (stdout_tx, stdout_rx) = channel::<Vec<u8>>(64);
    let (stderr_tx, stderr_rx) = channel::<Vec<u8>>(64);
    let events_child = child.clone();
    tauri::async_runtime::spawn(async move {
      while let Some(event) = events.recv().await {
        match event {
          CommandEvent::Stdout(output) => {
            if cfg!(debug_assertions) {
              println!(
                "{} {}",
                format!("[{}]", kind).purple(),
                String::from_utf8_lossy(&output).trim_end()
              );
            }
            let _ = stdout_tx.send(output).await;
          }
          CommandEvent::Stderr(output) => {
            if cfg!(debug_assertions) {
              eprintln!(
                "{} {} {}",
                format!("[{}]", kind).purple(),
                "[error]".red(),
                String::from_utf8_lossy(&output).trim_end()
              );
            }
            let _ = stderr_tx.send(output).await;
          }
          CommandEvent::Terminated(_) => {
            if let Ok(mut guard) = events_child.lock() {
              let _ = guard.take();
            }

            if let Ok(mut sidecars) = running_sidecars.lock() {
              sidecars.remove(&id);
            }
          }
          _ => {}
        }
      }
    });

    Ok(SidecarTransport {
      id,
      stdin: stdin_tx,
      stdout: stdout_rx,
      stderr: stderr_rx,
    })
  }

  fn terminate_sidecar_process(
    kind: SidecarKind,
    child: Arc<Mutex<Option<CommandChild>>>,
  ) -> anyhow::Result<()> {
    let mut child_guard = child
      .lock()
      .map_err(|_| anyhow::anyhow!("sidecar process mutex poisoned"))?;

    if let Some(process) = child_guard.take() {
      #[cfg(windows)]
      {
        if should_terminate_process_tree(kind) {
          let pid = process.pid();
          if let Err(error) = terminate_windows_process_tree(pid) {
            eprintln!(
              "Failed to terminate sidecar process tree for PID {pid}: {error:#}. Falling back to direct kill."
            );
            process.kill()?;
          }
        } else {
          process.kill()?;
        }
      }

      #[cfg(not(windows))]
      process.kill()?;
    }

    Ok(())
  }
}

#[cfg(windows)]
fn should_terminate_process_tree(kind: SidecarKind) -> bool {
  matches!(kind, SidecarKind::FasterWhisper | SidecarKind::YtDlp)
}

#[cfg(windows)]
fn terminate_windows_process_tree(pid: u32) -> anyhow::Result<()> {
  let output = Command::new("taskkill")
    .creation_flags(CREATE_NO_WINDOW)
    .args(["/PID", &pid.to_string(), "/T", "/F"])
    .output()
    .with_context(|| format!("Run taskkill for sidecar PID {pid}"))?;

  if output.status.success() || output.status.code() == Some(128) {
    return Ok(());
  }

  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

  anyhow::bail!(
    "taskkill exited with status {}. stdout: {} stderr: {}",
    output.status,
    stdout,
    stderr,
  );
}
