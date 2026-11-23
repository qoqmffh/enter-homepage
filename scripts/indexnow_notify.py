# -*- coding: utf-8 -*-
"""GEO 2차 지시서(2026-11-18) §4 — 배포(push) 직후 바뀐 URL 전체를 IndexNow에 알린다.
dist/ 안의 모든 *.html을 모아 https://api.indexnow.org/indexnow에 한 번에 POST한다.
실행: python scripts/indexnow_notify.py (build.py 안이 아니라 배포 뒤 독립 실행 — 실패해도
빌드·배포 자체는 이미 끝난 뒤라 영향 없음)."""
import glob
import json
import os
import urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "dist")
HOST = "xn--hq1b59iy0gstg.kr"
KEY = "172cf13cf2d7196f2e25c220df0f5410"  # build.py의 INDEXNOW_KEY와 동일


def main():
    # URL 통일 지시서(2026-11-23) — build.py의 page_url()과 같은 규칙: index는 "/",
    # 나머지는 "/slug"(.html 없음). dist의 파일명 자체는 그대로(xxx.html)지만, IndexNow에
    # 알리는 주소는 사이트가 스스로를 부르는 새 대표 주소와 맞춘다.
    urls = []
    for path in glob.glob(os.path.join(DIST_DIR, "*.html")):
        slug = os.path.splitext(os.path.basename(path))[0]
        href = "/" if slug == "index" else f"/{slug}"
        urls.append(f"https://{HOST}{href}")
    urls.sort()

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"IndexNow: {len(urls)}개 URL 전송, 응답 코드 {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"IndexNow: 실패(HTTP {e.code}) — {e.read().decode('utf-8', 'ignore')[:300]}")
    except Exception as e:
        print(f"IndexNow: 실패({type(e).__name__}: {e})")


if __name__ == "__main__":
    main()
