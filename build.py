# -*- coding: utf-8 -*-
"""
ENTER 홈페이지 빌드 스크립트
content/*.json(내용) + templates/*.html(레이아웃) → dist/*.html(최종 정적 페이지)
sitemap.xml · robots.txt 도 이 스크립트가 자동으로 만듭니다.

실행: python build.py
"""
import glob
import hashlib
import json
import os
import re
import shutil

from jinja2 import Environment, FileSystemLoader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(BASE_DIR, "content")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DIST_DIR = os.path.join(BASE_DIR, "dist")


def load_json(name):
    with open(os.path.join(CONTENT_DIR, name), encoding="utf-8") as f:
        return json.load(f)


_YEAR_RE = re.compile(r"^(19|20)\d{2}$")
_LEADING_NUM_RE = re.compile(r"^([\d][\d,]*)")


def is_countable(value):
    """스크롤 숫자 카운트업(지시서 2026-11-12) 대상인지 — static/reveal.js의 data-count
    대상을 템플릿에서 고를 때 쓰는 필터. 연도(2010)·0 값(0회·0원)·숫자 아닌 값(금요일·없음)은
    차오르지 않고 그대로 표시해야 하므로 여기서 걸러낸다. reveal.js도 같은 모양의 문자열에서
    숫자만 떼어 애니메이션하므로, 여기서 "세도 되는 값"만 미리 골라 data-count를 붙인다."""
    text = str(value)
    if _YEAR_RE.match(text):
        return False
    m = _LEADING_NUM_RE.match(text)
    if not m:
        return False
    return int(m.group(1).replace(",", "")) != 0


_ASSET_REF_RE = re.compile(r'((?:href|src)=")(static/[^"?]+\.(?:css|js))(")')
_asset_hash_cache = {}


def _asset_hash(rel_path):
    """static/xxx.css·js 파일의 내용 해시(8자리) — 캐시 무효화용(지시서 2026-11-14).
    파일이 바뀌어야만 해시도 바뀌므로, 배포 후 브라우저가 옛 CSS/JS를 계속 쓰는 문제를 막는다."""
    if rel_path not in _asset_hash_cache:
        abs_path = os.path.join(BASE_DIR, rel_path)
        with open(abs_path, "rb") as f:
            _asset_hash_cache[rel_path] = hashlib.sha256(f.read()).hexdigest()[:8]
    return _asset_hash_cache[rel_path]


def add_cache_busting(html):
    """렌더링된 HTML에서 static/*.css·*.js를 가리키는 href="..."/src="...."(type="module"
    스크립트 포함, 속성 순서는 안 가림)를 찾아 ?v=<해시>를 붙인다. 파일이 없으면 손대지 않는다."""
    def repl(match):
        prefix, rel_path, suffix = match.groups()
        if not os.path.isfile(os.path.join(BASE_DIR, rel_path)):
            return match.group(0)
        return f"{prefix}{rel_path}?v={_asset_hash(rel_path)}{suffix}"
    return _ASSET_REF_RE.sub(repl, html)


def _load_reference_text():
    """templates/*.html(partials 포함) + content/*.json 전체를 이어 붙인 문자열 —
    어떤 static 파일 경로가 실제로 쓰이는지 찾는 용도(아래 ignore_unreferenced_png)."""
    chunks = []
    for pattern in (os.path.join(TEMPLATES_DIR, "**", "*.html"), os.path.join(CONTENT_DIR, "*.json")):
        for path in glob.glob(pattern, recursive=True):
            with open(path, encoding="utf-8") as f:
                chunks.append(f.read())
    return "\n".join(chunks)


def make_png_ignore_fn(static_dir, reference_text):
    """static/ -> dist/static/ 복사 시 쓰는 shutil.copytree ignore 콜백(지시서 2026-11-14
    "최적화" §5) — 원본 *.png 중 어느 템플릿·content에도 경로가 안 나오는 파일만 뺀다
    (예: static/photos/Headquarters/1.png — 실제로는 같은 자리의 .webp만 쓴다).
    favicon-32.png·apple-touch-icon.png·evidence/*.png처럼 실제로 참조되는 png는
    그대로 복사된다(경로 문자열이 reference_text에 있으므로)."""
    def ignore(dir_path, names):
        skipped = []
        for name in names:
            full_path = os.path.join(dir_path, name)
            if name.lower().endswith(".png") and os.path.isfile(full_path):
                rel = os.path.relpath(full_path, static_dir).replace(os.sep, "/")
                if rel not in reference_text:
                    skipped.append(name)
        return skipped
    return ignore


def build_menu_summaries(site, pages, blog_posts):
    """메가 메뉴 초록 CTA 카드용 페이지 요약 — 지시서 2026-11-03.
    런타임에 다른 페이지를 불러오지 않도록 빌드 시점에 전부 미리 계산해서
    헤더 템플릿에 JSON으로 박아 넣는다(9개 항목 전부, 페이지 공통)."""
    summaries = {}
    for group in site["header_menu"]:
        for item in group["items"]:
            slug = item["slug"]
            page = pages[slug]
            if slug == "why":
                headline = page["poetic"]["hero"]["headline"]
            else:
                headline = page["sub"]["hero"]["headline"]

            numbers = None
            special_text = None
            if slug == "why":
                numbers = [{"value": s["num"], "label": s["label"]} for s in page["poetic"]["stats"][:2]]
            elif slug == "stories":
                special_text = "실제 발언을 모으고 있습니다"
            elif slug == "blog":
                count = len(blog_posts["pages"])
                numbers = [{"value": f"{count}편", "label": "발행된 글"}]
            elif slug == "faq":
                count = len(page["items"])
                numbers = [{"value": f"{count}개", "label": "자주 묻는 질문"}]
            else:
                facts = page["sub"]["proof"]["facts"][:2]
                numbers = [{"value": f["value"], "label": f["label"]} for f in facts]

            summaries[slug] = {
                "groupNum": group["num"],
                "pageLabel": item["label"],
                "headline": headline,
                "numbers": numbers,
                "specialText": special_text,
            }
    return summaries


def main():
    site = load_json("site.json")
    pages = load_json("pages.json")

    # 창업 가이드 챕터(guide.json)도 같은 방식으로 합쳐서 렌더링
    guide = load_json("guide.json")
    pages.update(guide["pages"])

    # 블로그 포스트(blog_posts.json)도 같은 방식으로 합쳐서 렌더링
    blog_posts = load_json("blog_posts.json")
    pages.update(blog_posts["pages"])

    menu_summaries = build_menu_summaries(site, pages, blog_posts)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    env.filters["countable"] = is_countable

    # dist/ 비우고 다시 생성
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)

    # static/ 통째로 복사 — 단, 어디서도 참조 안 하는 원본 png는 뺀다(지시서 2026-11-14 §5)
    reference_text = _load_reference_text()
    shutil.copytree(STATIC_DIR, os.path.join(DIST_DIR, "static"), ignore=make_png_ignore_fn(STATIC_DIR, reference_text))

    sitemap_entries = []

    for slug, page in pages.items():
        template = env.get_template(page["template"])
        legal_text = site["legal_footer_about"] if slug == "about" else site["legal_footer"]
        html = template.render(site=site, page=page, slug=slug, legal_text=legal_text, blog_posts=blog_posts["pages"], menu_summaries=menu_summaries)
        html = add_cache_busting(html)
        out_path = os.path.join(DIST_DIR, f"{slug}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        sitemap_entries.append((slug, page.get("date_modified", "")))
        print(f"  생성: {slug}.html")

    # sitemap.xml
    sitemap_lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for slug, lastmod in sitemap_entries:
        sitemap_lines.append("  <url>")
        sitemap_lines.append(f"    <loc>{site['base_url']}/{slug}.html</loc>")
        if lastmod:
            sitemap_lines.append(f"    <lastmod>{lastmod}</lastmod>")
        sitemap_lines.append("  </url>")
    sitemap_lines.append("</urlset>")
    with open(os.path.join(DIST_DIR, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(sitemap_lines))
    print("  생성: sitemap.xml")

    # robots.txt — 실제 존재하지 않는 /admin/ 같은 경로를 막을 필요가 없으므로 전체 허용 + sitemap만
    # site.noindex가 true면(실도메인 확정 전 임시 호스팅 단계) 크롤링 자체를 막음
    if site.get("noindex"):
        robots = "User-agent: *\nDisallow: /\n"
    else:
        robots = (
            "User-agent: *\n"
            "Allow: /\n"
            f"Sitemap: {site['base_url']}/sitemap.xml\n"
        )
    with open(os.path.join(DIST_DIR, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots)
    print("  생성: robots.txt")

    print(f"\n완료: {len(sitemap_entries)}개 페이지 + sitemap.xml + robots.txt -> dist/")
    print("주의: site.json의 base_url이 아직 placeholder입니다. 실제 도메인 확정되면 교체 후 재빌드하세요.")


if __name__ == "__main__":
    main()
