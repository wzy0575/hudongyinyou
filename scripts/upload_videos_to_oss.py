#!/usr/bin/env python3
"""Upload EP01-CH01 video assets to Aliyun OSS bucket hudongyingyou."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

# Project root = parent of scripts/
GAME_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = GAME_ROOT.parent
VIDEOS_DIR = GAME_ROOT / "EP01-CH01-videos"

BUCKET = "hudongyingyou"
ENDPOINT = "oss-cn-hangzhou.aliyuncs.com"
PUBLIC_URL = f"https://{BUCKET}.{ENDPOINT}"


def load_credentials():
    key_id = os.environ.get("OSS_ACCESS_KEY_ID")
    key_secret = os.environ.get("OSS_ACCESS_KEY_SECRET")
    if key_id and key_secret:
        return key_id, key_secret
    sys.path.insert(0, str(REPO_ROOT))
    try:
        from oss_config import OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET
        return OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET
    except ImportError as exc:
        raise SystemExit(
            "Missing OSS credentials. Set OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET "
            "or place oss_config.py in repo root."
        ) from exc


def oss_public_url(key: str) -> str:
  parts = key.replace("\\", "/").split("/")
  return PUBLIC_URL + "/" + "/".join(quote(p, safe="") for p in parts)


def main():
    import oss2

    if not VIDEOS_DIR.is_dir():
        raise SystemExit(f"Video folder not found: {VIDEOS_DIR}")

    key_id, key_secret = load_credentials()
    auth = oss2.Auth(key_id, key_secret)
    bucket = oss2.Bucket(auth, ENDPOINT, BUCKET)

    mp4_files = sorted(VIDEOS_DIR.rglob("*.mp4"))
    if not mp4_files:
        raise SystemExit("No .mp4 files found.")

    print(f"Bucket: {BUCKET}")
    print(f"Uploading {len(mp4_files)} videos from {VIDEOS_DIR}\n")

    for i, local in enumerate(mp4_files, 1):
        rel = local.relative_to(GAME_ROOT).as_posix()
        size_mb = local.stat().st_size / 1024 / 1024
        print(f"[{i}/{len(mp4_files)}] {rel} ({size_mb:.1f} MB)")

        with open(local, "rb") as f:
            bucket.put_object(rel, f)

        print(f"  -> {oss_public_url(rel)}")

    print("\nDone. Videos are at:")
    print(f"  {PUBLIC_URL}/EP01-CH01-videos/")
    print("\nEnsure bucket ACL / policy allows public read for video playback.")


if __name__ == "__main__":
    main()
