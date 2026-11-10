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
import subprocess
import xml.sax.saxutils as xml_escape

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


def compact(d):
    """dict에서 빈 값(None·""·[]·{})을 뺀다(마케팅 P0 지시서 2026-11-10 A30-1/A30-2) —
    JSON-LD에서 운영자 정보가 아직 안 채워진 키(logo 등)를 조용히 빼는 용도.
    템플릿에서 {{ some_dict | compact | tojson }}로 쓴다."""
    if not isinstance(d, dict):
        return d
    return {k: v for k, v in d.items() if v not in (None, "", [], {})}


def date_fmt(value):
    """'2026-10-22' -> '2026.10.22'(A16-1 날짜 줄 표기). 형식이 다르면 원문 그대로 둔다."""
    if not value or not re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)):
        return value
    return str(value).replace("-", ".")


_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_MD_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_MD_ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+?)\*(?!\*)")


def md_inline(text):
    """블로그 글 원고의 가벼운 인라인 마크다운(**굵게**·*기울임*·[글자](주소)만 지원)을
    안전하게 렌더링한다(블로그 글 3편 반영 지시서 2026-11-10). 먼저 markupsafe.escape로
    원문을 이스케이프한 뒤, 그 이스케이프된 문자열 위에서만 정규식으로 허용된 태그를
    되살려 붙이므로 원고에 <script> 등이 섞여 있어도 그대로 출력되지 않는다."""
    from markupsafe import Markup, escape

    if text is None:
        return Markup("")
    s = str(escape(str(text)))
    s = _MD_LINK_RE.sub(lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', s)
    s = _MD_BOLD_RE.sub(r"<strong>\1</strong>", s)
    s = _MD_ITALIC_RE.sub(r"<em>\1</em>", s)
    return Markup(s)


def faq_main_entity(items):
    """faq 블록 items([{q,a}])를 FAQPage JSON-LD의 mainEntity 배열로 바꾼다."""
    return [
        {
            "@type": "Question",
            "name": it["q"],
            "acceptedAnswer": {"@type": "Answer", "text": it["a"]},
        }
        for it in (items or [])
    ]


_git_date_cache = {}


def git_last_modified_date(rel_path):
    """content 파일의 git 마지막 커밋 날짜(YYYY-MM-DD) — 개별 글에 date_modified가 없을 때
    쓰는 대체값(A01-4). 항목별로 git blame까지 뜨는 건 너무 느려서, "이 항목이 들어있는
    content 파일 전체의 마지막 커밋일"로 근사한다 — 보통 글 하나만 고쳐도 파일 전체가
    커밋되는 구조라 실제로도 거의 정확하다. git이 없거나 커밋 이력이 없으면 None(빈 값)."""
    if rel_path in _git_date_cache:
        return _git_date_cache[rel_path]
    date = None
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", rel_path],
            cwd=BASE_DIR, capture_output=True, text=True, timeout=5,
        )
        if out.returncode == 0 and out.stdout.strip():
            date = out.stdout.strip()
    except Exception:
        date = None
    _git_date_cache[rel_path] = date
    return date


_FORBIDDEN_WORDS = ["온라인 대비 3배", "3배", "국대폰", "업계 1위", "1위"]
_TAG_STRIP_RE = re.compile(r"<[^>]+>")


def check_forbidden_words(dist_dir):
    """dist/*.html 텍스트에서 금지어를 찾는다(E-02). 빌드는 막지 않고 경고만 출력한다."""
    findings = []
    for path in sorted(glob.glob(os.path.join(dist_dir, "*.html"))):
        with open(path, encoding="utf-8") as f:
            html = f.read()
        text = _TAG_STRIP_RE.sub(" ", html)
        name = os.path.basename(path)
        for word in _FORBIDDEN_WORDS:
            idx = text.find(word)
            if idx != -1:
                snippet = text[max(0, idx - 20):idx + len(word) + 20].strip()
                snippet = re.sub(r"\s+", " ", snippet)
                findings.append((name, word, snippet))
    return findings


def find_orphan_pages(dist_dir, all_slugs):
    """어느 dist 페이지에서도 안 걸리는(= 내부 링크가 없는) 페이지를 찾는다(A34-2).
    sitemap.xml·robots.txt는 페이지가 아니라서 링크 대상에서 뺀다. 루트에서 시작하는
    링크만 셀 수 있지만, 여기서는 "전체 dist 안 어디서도 href로 한 번도 안 걸린 slug"를
    보수적으로 찾는다(한 군데서라도 걸리면 고아 아님)."""
    linked = set()
    href_re = re.compile(r'href="([a-zA-Z0-9_-]+)\.html(?:#[^"]*)?"')
    for path in glob.glob(os.path.join(dist_dir, "*.html")):
        with open(path, encoding="utf-8") as f:
            html = f.read()
        for m in href_re.finditer(html):
            linked.add(m.group(1))
    return sorted(s for s in all_slugs if s not in linked)


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

    # 사이트맵 3분리(A01-3)용 — 어느 content 파일에서 왔는지(= 어느 사이트맵에 들어갈지)
    # pages.update()로 섞이기 전에 미리 적어 둔다. content_file은 A01-4 git 대체 lastmod에도 쓴다.
    page_categories = {}
    page_source_file = {}
    for slug in pages:
        page_categories[slug] = "pages"
        page_source_file[slug] = "content/pages.json"

    # 창업 가이드 챕터(guide.json)도 같은 방식으로 합쳐서 렌더링
    guide = load_json("guide.json")
    pages.update(guide["pages"])
    for slug in guide["pages"]:
        page_categories[slug] = "guide"
        page_source_file[slug] = "content/guide.json"

    # 블로그 포스트(blog_posts.json)도 같은 방식으로 합쳐서 렌더링
    blog_posts = load_json("blog_posts.json")
    pages.update(blog_posts["pages"])
    for slug in blog_posts["pages"]:
        page_categories[slug] = "blog"
        page_source_file[slug] = "content/blog_posts.json"

    # 개인정보처리방침(A26-3) — 전용 content 파일 없이 여기서 바로 한 페이지 추가
    pages["privacy"] = {
        "template": "privacy.html",
        "title": "개인정보처리방침 | ENTER",
        "meta_description": "ENTER(엔터) 유선전문총판의 개인정보처리방침 — 수집 항목, 이용 목적, 보관 기간, 파기 방법, 문의처를 안내합니다.",
        "date_published": "2026-11-10",
        "date_modified": "2026-11-10",
    }
    page_categories["privacy"] = "pages"
    page_source_file["privacy"] = "build.py"

    menu_summaries = build_menu_summaries(site, pages, blog_posts)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    env.filters["countable"] = is_countable
    env.filters["compact"] = compact
    env.filters["date_fmt"] = date_fmt
    env.filters["md_inline"] = md_inline
    env.filters["faq_main_entity"] = faq_main_entity
    # A30-1/A30-2(마케팅 P0 2026-11-10) — tojson 기본값(ensure_ascii=True)이면
    # JSON-LD 속 한글이 \uXXXX로 이스케이프된다. 사람이 읽을 수 있게 끈다.
    env.policies["json.dumps_kwargs"] = {"ensure_ascii": False, "indent": 2}

    # dist/ 비우고 다시 생성
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)

    # static/ 통째로 복사 — 단, 어디서도 참조 안 하는 원본 png는 뺀다(지시서 2026-11-14 §5)
    reference_text = _load_reference_text()
    shutil.copytree(STATIC_DIR, os.path.join(DIST_DIR, "static"), ignore=make_png_ignore_fn(STATIC_DIR, reference_text))

    sitemap_entries = []  # (slug, lastmod, category)
    all_slugs = list(pages.keys())

    for slug, page in pages.items():
        template = env.get_template(page["template"])
        legal_text = site["legal_footer_about"] if slug == "about" else site["legal_footer"]
        html = template.render(site=site, page=page, slug=slug, legal_text=legal_text, blog_posts=blog_posts["pages"], menu_summaries=menu_summaries)
        html = add_cache_busting(html)
        out_path = os.path.join(DIST_DIR, f"{slug}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        # A01-4: date_modified가 없으면 이 항목이 들어있는 content 파일의 git 마지막 커밋일로 대체
        lastmod = page.get("date_modified") or git_last_modified_date(page_source_file[slug]) or ""
        sitemap_entries.append((slug, lastmod, page_categories[slug]))
        print(f"  생성: {slug}.html")

    # 사이트맵 3분리 + 인덱스(A01-3)
    def write_sitemap(filename, entries):
        lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for slug, lastmod, _cat in entries:
            lines.append("  <url>")
            lines.append(f"    <loc>{site['base_url']}/{slug}.html</loc>")
            if lastmod:
                lines.append(f"    <lastmod>{lastmod}</lastmod>")
            lines.append("  </url>")
        lines.append("</urlset>")
        with open(os.path.join(DIST_DIR, filename), "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"  생성: {filename} ({len(entries)}개)")

    sitemap_files = {
        "pages": "sitemap-pages.xml",
        "guide": "sitemap-guide.xml",
        "blog": "sitemap-blog.xml",
    }
    today = __import__("datetime").date.today().isoformat()
    index_lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for cat, filename in sitemap_files.items():
        cat_entries = [e for e in sitemap_entries if e[2] == cat]
        write_sitemap(filename, cat_entries)
        index_lines.append("  <sitemap>")
        index_lines.append(f"    <loc>{site['base_url']}/{filename}</loc>")
        index_lines.append(f"    <lastmod>{today}</lastmod>")
        index_lines.append("  </sitemap>")
    index_lines.append("</sitemapindex>")
    with open(os.path.join(DIST_DIR, "sitemap_index.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(index_lines))
    print("  생성: sitemap_index.xml")

    # RSS(A01-6) — 블로그 글만, 네이버 서치어드바이저 제출용
    rss_items = []
    for slug, bp in blog_posts["pages"].items():
        link = f"{site['base_url']}/{slug}.html"
        pub = bp.get("date_published", "")
        rss_items.append((pub, (
            "    <item>\n"
            f"      <title>{xml_escape.escape(bp.get('h1', bp.get('title', '')))}</title>\n"
            f"      <link>{xml_escape.escape(link)}</link>\n"
            f"      <guid>{xml_escape.escape(link)}</guid>\n"
            f"      <description>{xml_escape.escape(bp.get('meta_description', ''))}</description>\n"
            f"      <pubDate>{pub}</pubDate>\n"
            "    </item>"
        )))
    rss_items.sort(key=lambda t: t[0], reverse=True)  # 최신 글 먼저
    rss_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        f"    <title>{xml_escape.escape(site['site_name'])} 블로그</title>\n"
        f"    <link>{xml_escape.escape(site['base_url'])}/blog.html</link>\n"
        f"    <description>{xml_escape.escape(site.get('site_tagline', ''))}</description>\n"
        + "\n".join(item for _pub, item in rss_items) + "\n"
        "  </channel>\n"
        "</rss>\n"
    )
    with open(os.path.join(DIST_DIR, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(rss_xml)
    print(f"  생성: rss.xml ({len(rss_items)}개 글)")

    # robots.txt — 실제 존재하지 않는 /admin/ 같은 경로를 막을 필요가 없으므로 전체 허용 + sitemap만
    # site.noindex가 true면(실도메인 확정 전 임시 호스팅 단계) 크롤링 자체를 막음
    if site.get("noindex"):
        robots = "User-agent: *\nDisallow: /\n"
    else:
        robots = (
            "User-agent: *\n"
            "Allow: /\n"
            f"Sitemap: {site['base_url']}/sitemap_index.xml\n"
        )
    with open(os.path.join(DIST_DIR, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots)
    print("  생성: robots.txt")

    print(f"\n완료: {len(sitemap_entries)}개 페이지 + sitemap 4개 + rss.xml + robots.txt -> dist/")
    print("주의: site.json의 base_url이 아직 placeholder입니다. 실제 도메인 확정되면 교체 후 재빌드하세요.")

    # E-02: 금지어 빌드 검사(경고만, 빌드는 안 막음)
    findings = check_forbidden_words(DIST_DIR)
    if findings:
        print(f"\n[경고] 금지어 {len(findings)}건 발견:")
        for name, word, snippet in findings:
            print(f"  - {name}: '{word}' … {snippet}")
    else:
        print("\n금지어 검사: 이상 없음")

    # A34-2: 고아 페이지(내부 링크 없는 dist 페이지) 검사
    orphans = find_orphan_pages(DIST_DIR, all_slugs)
    # index는 모든 페이지가 '정상적으로' 링크 안 할 수 있는 시작점이라 제외하지 않고 그대로 보고하되,
    # 실제로는 헤더 로고(a.hp-brand)가 모든 페이지에서 index.html로 링크하므로 보통 고아가 아니다.
    if orphans:
        print(f"\n[참고] 어디서도 안 걸린(고아) 페이지 {len(orphans)}개:")
        for s in orphans:
            print(f"  - {s}.html")
    else:
        print("고아 페이지 검사: 이상 없음")


if __name__ == "__main__":
    main()
