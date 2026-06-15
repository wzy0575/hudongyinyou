import urllib.request
from pathlib import Path

html = urllib.request.urlopen(
    urllib.request.Request(
        "https://movie.douban.com/subject/30337864/",
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://movie.douban.com/"},
    ),
    timeout=20,
).read().decode("utf-8", "ignore")
Path(__file__).with_name("_douban_sample.html").write_text(html[:8000], encoding="utf-8")
print("len", len(html), "img count", html.count("doubanio"))
