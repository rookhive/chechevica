import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Iterable


def add_windows_dll_directories() -> None:
    if sys.platform != "win32":
        return

    for path in os.environ.get("PATH", "").split(os.pathsep):
        if not os.path.isdir(path):
            continue

        try:
            os.add_dll_directory(path)
        except (PermissionError, OSError):
            continue


add_windows_dll_directories()


def available_parallelism():
    if hasattr(os, "sched_getaffinity"):
        return len(os.sched_getaffinity(0))
    return os.cpu_count() or 1


os.environ["OMP_NUM_THREADS"] = str(available_parallelism())
os.environ["CT2_OPENMP_NUM_THREADS"] = str(available_parallelism())

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import ctranslate2
from faster_whisper import BatchedInferencePipeline, WhisperModel


COMPUTE_TYPES = ("int8", "float16", "float32")
DEVICE_CHOICES = ("cuda", "cpu")
JOB_KEYS = {
    "path",
    "device",
    "model",
    "compute_type",
    "batch_size",
    "beam_size",
    "language",
    "duration",
}


@dataclass(frozen=True)
class PipelineConfig:
    device: str
    model: str
    compute_type: str


@dataclass(frozen=True)
class JobRequest:
    path: str
    device: str | None = None
    model: str | None = None
    compute_type: str | None = None
    batch_size: int | None = None
    beam_size: int | None = None
    language: str | None = None
    duration: float | None = None


@dataclass(frozen=True)
class ResolvedJob:
    pipeline: PipelineConfig
    path: str
    batch_size: int
    beam_size: int
    language: str | None
    duration: float | None


def emit(event: dict[str, Any]) -> None:
    line = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    output = sys.stdout or sys.__stdout__

    try:
        output.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        output.buffer.flush()
    except Exception:
        output.write(line + "\n")
        output.flush()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default=None)
    parser.add_argument("--stdin", action="store_true")
    parser.add_argument("--device", choices=DEVICE_CHOICES, default=None)
    parser.add_argument("--model", default="tiny")
    parser.add_argument("--language", default="en")
    parser.add_argument("--batch-size", type=int, default=4, dest="batch_size")
    parser.add_argument("--beam-size", type=int, default=5, dest="beam_size")
    parser.add_argument(
        "--compute-type",
        choices=COMPUTE_TYPES,
        default="float16",
        dest="compute_type",
    )
    return parser.parse_args(argv)


def cuda_usable() -> bool:
    try:
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def round3(value: float) -> float:
    return round(float(value), 3)


def coerce_positive_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if number > 0 else None


def expect_optional_str(job: dict[str, Any], key: str) -> str | None:
    value = job.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise ValueError(f'"{key}" must be a non-empty string')
    return value


def expect_optional_int(job: dict[str, Any], key: str) -> int | None:
    value = job.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f'"{key}" must be a positive integer')
    return value


def normalize_job(job: dict[str, Any]) -> JobRequest:
    unknown_keys = sorted(set(job) - JOB_KEYS)
    if unknown_keys:
        joined = ", ".join(unknown_keys)
        raise ValueError(f"Unknown job fields: {joined}")

    path = job.get("path")
    if not isinstance(path, str) or not path:
        raise ValueError('Missing required "path" string')

    return JobRequest(
        path=path,
        device=expect_optional_str(job, "device"),
        model=expect_optional_str(job, "model"),
        compute_type=expect_optional_str(job, "compute_type"),
        batch_size=expect_optional_int(job, "batch_size"),
        beam_size=expect_optional_int(job, "beam_size"),
        language=expect_optional_str(job, "language"),
        duration=coerce_positive_float(job.get("duration")),
    )


def resolve_device(requested: str | None) -> str:
    if requested in DEVICE_CHOICES:
        return requested
    return "cuda" if cuda_usable() else "cpu"


def resolve_language(requested: str | None) -> str | None:
    if requested is None or requested == "auto":
        return None
    return requested


def resolve_job(args: argparse.Namespace, job: JobRequest) -> ResolvedJob:
    compute_type = job.compute_type or args.compute_type
    if compute_type not in COMPUTE_TYPES:
        raise ValueError(f"Invalid compute_type: {compute_type}")

    return ResolvedJob(
        pipeline=PipelineConfig(
            device=resolve_device(job.device or args.device),
            model=job.model or args.model,
            compute_type=compute_type,
        ),
        path=job.path,
        batch_size=job.batch_size or args.batch_size,
        beam_size=job.beam_size or args.beam_size,
        language=resolve_language(job.language or args.language),
        duration=job.duration,
    )


def load_pipeline(config: PipelineConfig) -> BatchedInferencePipeline:
    emit({"event": "loading_model_started", "device": config.device.upper()})
    started_at = time.perf_counter()

    whisper_model = WhisperModel(
        config.model,
        device=config.device,
        compute_type=config.compute_type,
        cpu_threads=available_parallelism(),
    )
    pipeline = BatchedInferencePipeline(model=whisper_model)

    emit(
        {
            "event": "loading_model_completed",
            "seconds": round3(time.perf_counter() - started_at),
        }
    )
    return pipeline


def emit_segment(start: float, end: float, total_duration: float, text: str) -> None:
    progress = min(100, int((end / total_duration) * 100))
    emit(
        {
            "event": "segment",
            "start": start,
            "end": end,
            "progress": progress,
            "text": text.strip(),
        }
    )


def emit_segments(segments: Iterable[Any], duration: float | None) -> None:
    if duration is not None:
        for segment in segments:
            emit_segment(
                start=float(segment.start),
                end=float(segment.end),
                total_duration=duration,
                text=segment.text,
            )
        return

    buffered_segments = list(segments)
    total_duration = max(
        (float(segment.end) for segment in buffered_segments),
        default=1e-6,
    )

    for segment in buffered_segments:
        emit_segment(
            start=float(segment.start),
            end=float(segment.end),
            total_duration=total_duration,
            text=segment.text,
        )


def transcribe_job(pipeline: BatchedInferencePipeline, job: ResolvedJob) -> None:
    emit({"event": "transcribing_started"})
    started_at = time.perf_counter()

    segments, _info = pipeline.transcribe(
        job.path,
        batch_size=job.batch_size,
        beam_size=job.beam_size,
        language=job.language,
        word_timestamps=False,
        chunk_length=30,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    emit_segments(segments, job.duration)
    emit(
        {
            "event": "transcribing_completed",
            "seconds": round3(time.perf_counter() - started_at),
        }
    )


def run_single_job(args: argparse.Namespace) -> int:
    job = resolve_job(
        args,
        JobRequest(
            path=args.path,
            batch_size=args.batch_size,
            beam_size=args.beam_size,
            language=args.language,
        ),
    )
    pipeline = load_pipeline(job.pipeline)
    transcribe_job(pipeline, job)
    return 0


def run_stdin_loop(args: argparse.Namespace) -> int:
    active_config: PipelineConfig | None = None
    pipeline: BatchedInferencePipeline | None = None

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            job_payload = json.loads(line)
            if not isinstance(job_payload, dict):
                raise ValueError("Job must be a JSON object")

            job = resolve_job(args, normalize_job(job_payload))
            if job.pipeline != active_config or pipeline is None:
                pipeline = load_pipeline(job.pipeline)
                active_config = job.pipeline

            transcribe_job(pipeline, job)
        except Exception as error:
            emit({"event": "error", "message": str(error)})

    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.stdin or args.path is None:
        return run_stdin_loop(args)

    return run_single_job(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        emit({"event": "error", "message": str(error)})
        raise
