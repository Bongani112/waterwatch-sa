import uuid
from pathlib import Path

from app.core.config import get_settings

# Validate by file signature, not by the client-supplied content type.
SIGNATURES: dict[str, tuple[bytes, str]] = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


def detect_image_type(data: bytes) -> tuple[str, str] | None:
    for content_type, (magic, ext) in SIGNATURES.items():
        if data.startswith(magic):
            return content_type, ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


def upload_root() -> Path:
    root = Path(get_settings().upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(data: bytes, ext: str) -> str:
    name = f"{uuid.uuid4().hex}{ext}"
    (upload_root() / name).write_bytes(data)
    return name


def resolve_upload(name: str) -> Path | None:
    root = upload_root().resolve()
    path = (root / name).resolve()
    if path.parent != root or not path.is_file():
        return None
    return path
