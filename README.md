<h1 align="center">
  <img src="src-tauri/icons/128x128.png" />
  <br>
  Chechevica
</h1>

Desktop search engine for spoken content in audio and video - automatically transcribes, indexes segments, and enables fast full-text and semantic search.


## ✨ Features

- 🎙️ **Flexible Transcription**: Local transcription of audio and video with a configurable UI
- 🔍 **Powerful Search**: Full-text and semantic search across all transcribed content
- 🧠 **Efficient Processing**: Batch processing pipeline with job queueing and smart model reuse (avoids unnecessary model loading/unloading)
- 🚀 **CUDA Acceleration**: Optimized for NVIDIA CUDA - no manual installation of CUDA Toolkit or cuDNN required (all necessary libraries are bundled; see [license notes](THIRD_PARTY_NOTICES.txt))
- ⚙️ **Pipeline Control**: Full control with step-by-step processing visualization, detailed progress information, and the ability to stop execution and rerun processing from any stage
- 📁 **Project Organization**: Project-based organization of transcribed sources
- 🎯 **Scoped Search**: Configurable search scope: across all projects, a specific project, or a single source
- 🎨 **Convenient UI**: Browser-like interface with tabs and independent navigation history
- ➕ **YouTube Integration**: Download videos and playlists with quick navigation to specific timestamps in the original content
- 🎬 **Synchronized Playback**: Integrated media player with synchronized transcript scrolling and active segment highlighting
- ✂️ **Segment Export**: Export selected transcript segments as a single audio or video file


https://github.com/user-attachments/assets/c6c830f4-f542-43cf-a172-868b7991d8ce


## 🛠️ Prerequisites

- OS: Windows 10/11 (64-bit)
- GPU (for CUDA version): NVIDIA (GTX 10 series or newer / any RTX), CUDA 12 compatible, 6GB+ VRAM


## 🚀 Installation

Download the `.msi` installer from the [Releases](https://github.com/rookhive/chechevica/releases/latest) page:

- 💻 `Chechevica_0.1.11_x64_en-US.msi` - regular version of the app **without** GPU-acceleration
- 💻⚡️ `Chechevica_CUDA_0.1.11_x64_en-US.msi` - CUDA-accelerated version of the app, highly recommended, up to 20-30x faster than the regular version. Requires an NVIDIA GPU


## 🧹 Uninstalling

The uninstaller does not delete data directories by default:

- `C:\Users\<username>\AppData\Local\<identifier>` (app data directory)
- `C:\Users\<username>\.cache\huggingface` (models downloaded from Hugging Face)

> Identifiers: `io.chechevica.app` and `io.chechevica.app.cuda` (for CUDA version)

Delete these directories manually if needed

## 👨🏼‍💻 Development

### Windows

Requirements:

1. Node.js, Rust, Python, pnpm

#### CPU version

```pwsh
pnpm install
pnpm generate:db
pnpm generate:types
pnpm dev:cpu
```

#### CUDA-accelerated version

Requirements:

2. [NVIDIA CUDA Toolkit](https://developer.nvidia.com/cuda-12-8-0-download-archive?target_os=Windows&target_arch=x86_64)
   > IMPORTANT: only 12.x is supported

3. [cuDNN 9 for CUDA 12](https://developer.nvidia.com/cudnn-downloads?target_os=Windows&target_arch=x86_64)
   > IMPORTANT: in the installer select version for CUDA 12.x

```pwsh
pnpm install
pnpm generate:db
pnpm generate:types
pnpm dev:cuda
```

## 👨🏼‍💻 Build

```pwsh
pnpm build:cpu
```

### CUDA version

The build pipeline copies all files from `src-tauri/dll` into the bundle. Therefore, the directory must exist at build time, even if it is empty.

```pwsh
pnpm build:cuda
```
