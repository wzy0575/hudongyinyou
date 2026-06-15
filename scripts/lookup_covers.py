#!/usr/bin/env python3
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com"}


def get_json(url, referer=None):
    h = dict(UA)
    if referer:
        h["Referer"] = referer
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=20).read())


def search_bilibili(keyword):
    url = (
        "https://api.bilibili.com/x/web-interface/search/type"
        f"?search_type=media_bangumi&keyword={urllib.parse.quote(keyword)}"
    )
    data = get_json(url)
    for item in data.get("data", {}).get("result", []):
        print("  ", item.get("media_id"), item.get("title"), item.get("cover", "")[:70])


def douban_info(sid):
    html = urllib.request.urlopen(
        urllib.request.Request(
            f"https://book.douban.com/subject/{sid}/",
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://book.douban.com/"},
        ),
        timeout=20,
    ).read().decode("utf-8", "ignore")
    title = re.search(r'property="v:itemreviewed">([^<]+)<', html)
    img = re.search(r"https://img[^\"']+\.doubanio\.com/view/subject/s/public/s\d+\.jpg", html)
    print(sid, title.group(1) if title else "?", img.group(0) if img else "no img")


if __name__ == "__main__":
    import urllib.parse

    print("=== bilibili search 星辰变 ===")
    search_bilibili("星辰变")

    print("\n=== douban books ===")
    for sid in ["25862578", "26797673", "26369767", "26957760", "27025715"]:
        douban_info(sid)
