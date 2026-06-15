import re
import urllib.request

for sid, kind in [("30506701", "book"), ("30337864", "movie")]:
    base = "https://book.douban.com" if kind == "book" else "https://movie.douban.com"
    html = urllib.request.urlopen(
        urllib.request.Request(
            f"{base}/subject/{sid}/",
            headers={"User-Agent": "Mozilla/5.0", "Referer": base + "/"},
        ),
        timeout=20,
    ).read().decode("utf-8", "ignore")
    title = re.search(r'property="v:itemreviewed">([^<]+)<', html)
    img = re.search(r"https://img[^\"']+\.doubanio\.com/view/subject/[sl]/public/s\d+\.jpg", html)
    print(kind, sid, title.group(1) if title else "?", img.group(0) if img else "no", "len", len(html))

# tencent og image
html2 = urllib.request.urlopen(
    urllib.request.Request(
        "https://v.qq.com/x/cover/0s8n49g3g1rv1oz/a00418h9nzc.html",
        headers={"User-Agent": "Mozilla/5.0"},
    ),
    timeout=20,
).read().decode("utf-8", "ignore")
og = re.findall(r'property="og:image" content="([^"]+)"', html2)
print("tencent og", og[:2])
