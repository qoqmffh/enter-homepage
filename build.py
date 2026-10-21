# -*- coding: utf-8 -*-
"""
ENTER 홈페이지 빌드 스크립트
content/*.json(내용) + templates/*.html(레이아웃) → dist/*.html(최종 정적 페이지)
sitemap.xml · robots.txt 도 이 스크립트가 자동으로 만듭니다.

실행: python build.py
"""
import json
import os
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


def main():
    site = load_json("site.json")
    pages = load_json("pages.json")

    # 창업 가이드 챕터(guide.json)도 같은 방식으로 합쳐서 렌더링
    guide = load_json("guide.json")
    pages.update(guide["pages"])

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

    # dist/ 비우고 다시 생성
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)

    # static/ 통째로 복사
    shutil.copytree(STATIC_DIR, os.path.join(DIST_DIR, "static"))

    sitemap_entries = []

    for slug, page in pages.items():
        template = env.get_template(page["template"])
        legal_text = site["legal_footer_about"] if slug == "about" else site["legal_footer"]
        html = template.render(site=site, page=page, slug=slug, legal_text=legal_text)
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
