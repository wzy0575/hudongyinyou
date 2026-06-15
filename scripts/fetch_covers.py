#!/usr/bin/env python3
"""Fetch cover images for game series cards."""
import re
import urllib.request
from pathlib import Path
from typing import Optional

OUT = Path(__file__).resolve().parents[2] / "wzy-site" / "assets" / "game-covers"
OUT.mkdir(parents=True, exist_ok=True)

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.douban.com/",
}


def fetch_url(url: str, referer: Optional[str] = None) -> bytes:
    headers = dict(UA)
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def douban_cover(subject_id: str) -> Optional[str]:
    html = fetch_url(f"https://book.douban.com/subject/{subject_id}/").decode("utf-8", "ignore")
    m = re.search(r"https://img[^\"']+\.doubanio\.com/view/subject/[sl]/public/s\d+\.jpg", html)
    if not m:
        return None
    return m.group(0).replace("/s/public/", "/l/public/")


def tencent_cover(page_url: str) -> Optional[str]:
    html = fetch_url(page_url, referer="https://v.qq.com/").decode("utf-8", "ignore")
    m = re.search(r'property="og:image" content="([^"]+)"', html)
    return m.group(1) if m else None


def download(name: str, url: str, referer: Optional[str] = None) -> Path:
    ext = ".png" if ".png" in url.lower() else ".jpg"
    dest = OUT / f"{name}{ext}"
    print(f"Downloading {name} <- {url}")
    dest.write_bytes(fetch_url(url, referer=referer or "https://www.douban.com/"))
    print(f"  -> {dest} ({dest.stat().st_size // 1024} KB)")
    return dest


WIKI = {
    "xingchenbian": "https://img1.doubanio.com/view/subject/l/public/s33639529.jpg",
    "ww1": "https://img9.doubanio.com/view/subject/l/public/s28668834.jpg",
}


def main() -> None:
    xcb = tencent_cover("https://v.qq.com/x/cover/0s8n49g3g1rv1oz/a00418h9nzc.html")
    try:
        if xcb:
            download("xingchenbian", xcb, referer="https://v.qq.com/")
        else:
            raise ValueError("no tencent cover")
    except Exception as e:
        print(f"WARN xingchenbian: {e}")
        download("xingchenbian", WIKI["xingchenbian"])

    books = {
        "ww1": "26698660",       # 巨人的陨落
        "ww2": "26957760",       # 世界的凛冬
        "cold-war": "27025715",  # 永恒的边缘
    }
    for name, sid in books.items():
        try:
            url = douban_cover(sid)
            if not url:
                raise ValueError("no cover url")
            download(name, url)
        except Exception as e:
            print(f"WARN {name}: {e}")
            if name in WIKI:
                download(name, WIKI[name])

    # remove stale wrong cover
    stale = OUT / "xingchenbian.png"
    if stale.exists():
        stale.unlink()
        print("Removed stale xingchenbian.png")

    print("\nDone:")
    for p in sorted(OUT.glob("*")):
        print(f"  {p.name}  {p.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
