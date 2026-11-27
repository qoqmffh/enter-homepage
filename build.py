# -*- coding: utf-8 -*-
"""
ENTER 홈페이지 빌드 스크립트
content/*.json(내용) + templates/*.html(레이아웃) → dist/*.html(최종 정적 페이지)
sitemap.xml · robots.txt 도 이 스크립트가 자동으로 만듭니다.

실행: python build.py
"""
import datetime
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import xml.sax.saxutils as xml_escape
from html.parser import HTMLParser

import lxml.html
from jinja2 import Environment, FileSystemLoader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(BASE_DIR, "content")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DIST_DIR = os.path.join(BASE_DIR, "dist")

# IndexNow 키(GEO 2차 지시서 2026-11-18 §4) — scripts/indexnow_notify.py와 공유.
INDEXNOW_KEY = "172cf13cf2d7196f2e25c220df0f5410"

# ---------------------------------------------------------------------------
# 폰트 서브셋(속도 개선 지시서 2026-11-23 §2-①) — Pretendard 가변 폰트 원본
# (fonts-source/PretendardVariable.ttf, static/ 밖이라 dist에 안 들어간다)에서
# 실제로 쓰는 굵기(300~800)만 인스턴스화하고, 실제로 쓰는 글자만 추려 woff2 1개로
# 만든다. 파일 이름에 글자 집합 해시를 붙여서(pretendard-subset.<hash>.woff2),
# 글자가 바뀌면 자동으로 새 파일이 되고(캐시 무효화), 안 바뀌면 fonts-source/.cache/
# 안의 이미 만든 파일을 그대로 쓴다(매번 느린 fontTools 서브셋을 다시 안 돌림).
FONT_SOURCE = os.path.join(BASE_DIR, "fonts-source", "PretendardVariable.ttf")
FONT_CACHE_DIR = os.path.join(BASE_DIR, "fonts-source", ".cache")
FONT_PLACEHOLDER = "__FONT_SUBSET_HREF__"
FONT_WEIGHT_RANGE = "300 800"  # CSS font-weight 범위 — site.css·home-ad.js에서 실제 쓰는 굵기

# 항상 포함: 영문 대소문자·숫자·기본 문장부호(출력 가능 ASCII 전체) + 원화·화살표·말줄임표·대시.
_FONT_ALWAYS_CHARS = set(
    "".join(chr(c) for c in range(0x20, 0x7F))  # 출력 가능 ASCII(공백~물결표)
    + "₩→←↑↓…—–"
)
_JSONLD_SCRIPT_RE = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)


def collect_font_chars(dist_dir, static_dir, content_dir):
    """dist 전체 텍스트(JSON-LD 제외) + static/*.js 문자열 + content/*.json(안전망,
    HTML에 아직 안 반영됐을 수 있는 문구 대비) + 항상 포함 세트를 모은 고유 글자 집합."""
    chars = set(_FONT_ALWAYS_CHARS)
    for path in sorted(glob.glob(os.path.join(dist_dir, "*.html"))):
        with open(path, encoding="utf-8") as f:
            html = f.read()
        chars.update(_JSONLD_SCRIPT_RE.sub("", html))
    for path in sorted(glob.glob(os.path.join(static_dir, "*.js"))):
        with open(path, encoding="utf-8") as f:
            chars.update(f.read())
    for path in sorted(glob.glob(os.path.join(content_dir, "*.json"))):
        with open(path, encoding="utf-8") as f:
            chars.update(f.read())
    chars -= {"\n", "\t", "\r"}
    return chars


def build_font_subset(chars, out_dir):
    """글자 집합 해시로 캐시를 확인하고, 없으면 fontTools로 새로 만든다.
    반환: (파일명, 새로 만들었는지 여부)."""
    sorted_chars = "".join(sorted(chars))
    chars_hash = hashlib.sha256(sorted_chars.encode("utf-8")).hexdigest()[:8]
    out_name = f"pretendard-subset.{chars_hash}.woff2"
    out_path = os.path.join(out_dir, out_name)
    os.makedirs(FONT_CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(FONT_CACHE_DIR, out_name)

    if os.path.exists(cache_path):
        shutil.copy(cache_path, out_path)
        return out_name, False

    if not os.path.exists(FONT_SOURCE):
        raise FileNotFoundError(
            f"폰트 원본이 없습니다: {FONT_SOURCE} — Pretendard Variable TTF를 이 경로에 두세요"
            "(orioncactus/pretendard 릴리스의 public/variable/PretendardVariable.ttf)."
        )

    instanced_path = os.path.join(FONT_CACHE_DIR, f"_instanced_{chars_hash}.ttf")
    text_path = os.path.join(FONT_CACHE_DIR, f"_chars_{chars_hash}.txt")
    try:
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(sorted_chars)
        wght_lo, wght_hi = FONT_WEIGHT_RANGE.split()
        subprocess.run(
            [sys.executable, "-m", "fontTools.varLib.instancer",
             FONT_SOURCE, f"wght={wght_lo}:{wght_hi}", "-o", instanced_path],
            check=True, capture_output=True,
        )
        subprocess.run(
            [sys.executable, "-m", "fontTools.subset", instanced_path,
             f"--text-file={text_path}", "--flavor=woff2",
             f"--output-file={cache_path}",
             "--layout-features=*", "--no-hinting"],
            check=True, capture_output=True,
        )
    finally:
        for p in (instanced_path, text_path):
            if os.path.exists(p):
                os.remove(p)

    shutil.copy(cache_path, out_path)
    return out_name, True


# ---------------------------------------------------------------------------
# CSS·JS 묶기(속도 개선 지시서 2026-11-23 §2-④) — esbuild로 압축(minify)만 한다
# (여러 파일을 합칠 때는 그냥 이어붙인 뒤 압축 — 전부 IIFE라 안전). 공통(모든 페이지)·
# 조건부 공통(index 제외)·페이지 전용(why·블로그 글) 묶음은 파일명에 내용 해시를 넣어
# 템플릿에서 직접 참조한다(bundle_href). 어느 페이지에서도 다른 파일과 안 묶이는
# 단일 파일(article.css·sub.css·home-ad.*·post-interactions.js·voices-carousel.js)은
# 이름은 그대로 두고 압축만 해서, 기존 add_cache_busting()의 ?v= 해시가 그대로 먹게 한다.
ESBUILD_BIN = os.path.join(BASE_DIR, "scripts", "node_modules", "esbuild", "bin", "esbuild")

CSS_BUNDLES = {
    "common": ["static/common.css", "static/site.css", "static/megamenu.css"],
    "chrome": ["static/reveal.css", "static/lead-modal.css", "static/floatnav.css"],
    "why": ["static/home-poetic.css", "static/sub.css"],
    "blogpost": ["static/article.css", "static/sub.css"],
}
JS_BUNDLES = {
    "common": ["static/megamenu.js"],
    "chrome": ["static/reveal.js", "static/lead-modal.js", "static/floatnav.js"],
    "why": [
        "static/home-poetic.js", "static/home-poetic-cards.js", "static/home-poetic-trail.js",
        "static/voices-carousel.js", "static/why-carousels.js", "static/why-chart.js", "static/wipe-reveal.js",
    ],
}
# 어느 묶음에도 안 들어가지만 그 자체로 압축은 해야 하는 단일 파일(원래 이름 그대로 둠).
STANDALONE_MINIFY = {
    "css": ["static/article.css", "static/sub.css", "static/home-ad.css"],
    "js": ["static/home-ad.js", "static/post-interactions.js", "static/voices-carousel.js"],
}
# 묶음에만 들어가고 따로는 아무도 안 쓰는 원본 — dist에서 지운다(common.css 등은 어차피
# 아무 페이지도 더는 직접 안 받지만, 안 지우면 쓸모없이 그대로 배포된다).
_BUNDLED_FILES = {f for files in CSS_BUNDLES.values() for f in files} | {f for files in JS_BUNDLES.values() for f in files}
_STANDALONE_FILES = set(STANDALONE_MINIFY["css"]) | set(STANDALONE_MINIFY["js"])
BUNDLE_ORPHANS = sorted(_BUNDLED_FILES - _STANDALONE_FILES)


def _esbuild_minify(text, loader):
    # Windows에서 esbuild/bin/esbuild는 실제 네이티브 실행 파일을 골라 실행하는 작은
    # Node 스크립트라 "node 그 파일"로 돌려야 한다. 리눅스(= GitHub Actions)에서는
    # 그 자리에 네이티브 실행 파일(ELF)이 직접 들어가 있어서 node로 돌리면 "그 바이너리를
    # JS로 해석하려다 문법 오류" 가 난다 — 운영체제별로 호출 방식 자체가 다르다.
    cmd = ["node", ESBUILD_BIN] if os.name == "nt" else [ESBUILD_BIN]
    result = subprocess.run(
        [*cmd, f"--loader={loader}", "--minify"],
        input=text.encode("utf-8"), capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"esbuild 실패(loader={loader}): {result.stderr.decode('utf-8', 'replace')}"
        )
    return result.stdout.decode("utf-8")


def build_bundles(dist_dir):
    """CSS_BUNDLES·JS_BUNDLES를 묶어 dist/static/에 해시 파일명으로 쓰고, STANDALONE_MINIFY는
    같은 자리에서 압축만 해 제자리에 덮어쓴다. 반환: {(name, ext): href} 묶음 매핑."""
    hrefs = {}
    for ext, bundles, loader in (("css", CSS_BUNDLES, "css"), ("js", JS_BUNDLES, "js")):
        for name, files in bundles.items():
            combined = ""
            for rel in files:
                with open(os.path.join(BASE_DIR, rel), encoding="utf-8") as f:
                    combined += f.read() + "\n"
            minified = _esbuild_minify(combined, loader)
            content_hash = hashlib.sha256(minified.encode("utf-8")).hexdigest()[:8]
            out_name = f"{name}.{content_hash}.{ext}"
            with open(os.path.join(dist_dir, "static", out_name), "w", encoding="utf-8") as f:
                f.write(minified)
            hrefs[(name, ext)] = f"static/{out_name}"

    for ext, files in STANDALONE_MINIFY.items():
        for rel in files:
            with open(os.path.join(BASE_DIR, rel), encoding="utf-8") as f:
                minified = _esbuild_minify(f.read(), ext)
            with open(os.path.join(dist_dir, rel), "w", encoding="utf-8") as f:
                f.write(minified)

    for rel in BUNDLE_ORPHANS:
        p = os.path.join(dist_dir, rel)
        if os.path.exists(p):
            os.remove(p)

    return hrefs


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


_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def date_fmt_kr(value):
    """'2026-11-16' -> '2026년 11월 16일'(AI 검색 대응 지시서 2026-11-16 §3, 페이지
    "기준일" 표기용). 형식이 다르면 원문 그대로 둔다."""
    m = _DATE_RE.match(str(value or ""))
    if not m:
        return value
    y, mo, d = m.groups()
    return f"{y}년 {int(mo)}월 {int(d)}일"


def date_fmt_dot(value):
    """'2026-11-18' -> '2026. 11. 18.'(디자인 완성 지시서 2026-11-19 Phase 4, 블로그
    글 작성자 줄의 네이버식 날짜 표기). 형식이 다르면 원문 그대로 둔다."""
    m = _DATE_RE.match(str(value or ""))
    if not m:
        return value
    y, mo, d = m.groups()
    return f"{y}. {int(mo)}. {int(d)}."


_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_MD_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_MD_ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+?)\*(?!\*)")


_HEADING_SLUG_STRIP_RE = re.compile(r"[^\w가-힣\s-]")
_HEADING_SLUG_SPACE_RE = re.compile(r"\s+")


def heading_slug(text):
    """메뉴구조 개편 지시서(2026-11-27) §3 — 읽을거리 페이지 왼쪽 목차용 소제목 id를
    build.py에서 자동 생성한다. 한글·영문·숫자만 남기고 공백을 -로 바꾼 "한글 슬러그"다
    (같은 글자는 항상 같은 id가 나오므로 "고정"된다). 빈 문자열이면 번호로 대체한다."""
    s = _HEADING_SLUG_STRIP_RE.sub("", str(text or "")).strip()
    s = _HEADING_SLUG_SPACE_RE.sub("-", s)
    return s or "section"


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


def strip_md(text):
    """표기 통일 지시서(2026-11-12) A30-3 — JSON-LD 같은 순수 텍스트 필드에는 원고의
    [글자](주소) 링크 문법을 빼고 글자만 남긴다(화면 표시는 md_inline으로 그대로 링크 유지)."""
    if text is None:
        return text
    s = _MD_LINK_RE.sub(r"\1", str(text))
    s = _MD_BOLD_RE.sub(r"\1", s)
    s = _MD_ITALIC_RE.sub(r"\1", s)
    return s


def breadcrumb_ld(items, base_url):
    """브레드크럼 items([{label,href}, ...])를 BreadcrumbList JSON-LD로 바꾼다
    (마케팅 마무리 지시서 2026-11-12 D). href는 URL 통일 지시서(2026-11-23) 이후
    page_href()가 만든 절대 경로("/" 또는 "/slug")라 base_url 뒤에 그대로 붙인다."""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": it["label"],
                "item": base_url + it["href"],
            }
            for i, it in enumerate(items)
        ],
    }


def faq_main_entity(items):
    """faq 블록 items([{q,a}])를 FAQPage JSON-LD의 mainEntity 배열로 바꾼다."""
    return [
        {
            "@type": "Question",
            "name": strip_md(it["q"]),
            "acceptedAnswer": {"@type": "Answer", "text": strip_md(it["a"])},
        }
        for it in (items or [])
    ]


_git_date_cache = {}


def git_last_modified_date(rel_path):
    """content 파일의 git 마지막 커밋 날짜(YYYY-MM-DD) — 개별 글에 date_modified가 없을 때
    쓰는 대체값(A01-4). 항목별로 git blame까지 뜨는 건 너무 느려서, "이 항목이 들어있는
    content 파일 전체의 마지막 커밋일"로 근사한다 — 보통 글 하나만 고쳐도 파일 전체가
    커밋되는 구조라 실제로도 거의 정확하다. git이 없거나 커밋 이력이 없으면 None(빈 값).

    원칙(기준일 판단 정정 지시서 2026-11-16): date_modified는 git 날짜의 자동 대체에
    기대지 말고, 본문 내용(답 문장·숫자·FAQ 등)을 실제로 고치는 커밋에서 그 페이지의
    date_modified도 같은 커밋 안에서 함께 올린다. 브랜드 한 줄(site.cta_brand_line)·CTA
    버튼 문구처럼 여러 페이지에 공통으로 퍼지는 요소만 바뀐 경우는 올리지 않는다."""
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


_FORBIDDEN_WORDS = ["온라인 대비 3배", "3배", "국대폰", "업계 1위", "1위", "15년", "2010년 설립"]
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
    보수적으로 찾는다(한 군데서라도 걸리면 고아 아님).
    URL 통일 지시서(2026-11-23) §2-5 — 새 형식(href="/slug", href="/")과 옛 형식
    (href="slug.html", 혹시 남아 있으면 잡아내려고 방어적으로 같이 본다) 둘 다 검사한다."""
    linked = set()
    href_re = re.compile(r'href="(?:/([a-zA-Z0-9_-]+)|(/)|([a-zA-Z0-9_-]+)\.html)(?:#[^"]*)?"')
    for path in glob.glob(os.path.join(dist_dir, "*.html")):
        with open(path, encoding="utf-8") as f:
            html = f.read()
        for m in href_re.finditer(html):
            if m.group(1):
                linked.add(m.group(1))
            elif m.group(2):
                linked.add("index")
            elif m.group(3):
                linked.add(m.group(3))
    return sorted(s for s in all_slugs if s not in linked)


_MAIN_TEXT_DROP_XPATHS = [
    ".//*[@data-lead-trigger]",
    ".//a[starts-with(@href, 'tel:')]",
    ".//a[starts-with(@href, 'sms:')]",
    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' hp-pill ')]",
    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' btn ')]",
    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' confirm-box ')]",
    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' breadcrumb ')]",
    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' page-basis-date ')]",
]


def extract_main_text(html):
    """<main> 안의 사람이 읽는 본문만 뽑는다(AI 검색 대응 지시서 2026-11-16 §2,
    llms-full.txt용) — 메뉴·푸터는 <main> 밖이라 이미 빠지고, 버튼·tel/sms 링크·
    breadcrumb·확인 기준 상자·기준일 표기는 위 드롭 목록으로 걷어낸다."""
    try:
        doc = lxml.html.fromstring(html)
    except Exception:
        return ""
    mains = doc.xpath("//main")
    if not mains:
        return ""
    main = mains[0]
    for xp in _MAIN_TEXT_DROP_XPATHS:
        for el in main.xpath(xp):
            el.drop_tree()
    text = main.text_content()
    lines = [ln.strip() for ln in text.splitlines()]
    text = "\n".join(ln for ln in lines if ln)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


_GLOSSARY_VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
_GLOSSARY_EXCLUDE_TAGS = {"h1", "h2", "h3", "a", "button", "script", "style", "summary", "nav"}
_GLOSSARY_EXCLUDE_CLASSES = {"confirm-box", "breadcrumb", "sp-cta-brand", "page-basis-date"}


class _GlossaryLinker(HTMLParser):
    """용어 사전 자동 링크(용어 사전 지시서 2026-11-16 §4) — <main> 안의 순수 텍스트에서
    용어가 처음 나올 때 한 번만 glossary.html#slug로 링크할 위치를 찾는다. lxml로 파싱해
    통째로 다시 직렬화하면 viewBox 같은 SVG 대소문자 속성이 깨지는 걸 실제로 확인해서
    (라운드트립 테스트 2026-11-16), 원본 문자열은 절대 건드리지 않고 html.parser로 위치만
    찾은 뒤 정확한 글자 위치에 <a> 문자열만 끼워 넣는 방식으로 바꿨다."""

    def __init__(self, raw, terms):
        super().__init__(convert_charrefs=False)
        self.raw = raw
        self._line_offsets = [0]
        off = 0
        for ln in raw.split("\n")[:-1]:
            off += len(ln) + 1
            self._line_offsets.append(off)
        self.tag_stack = []
        self.in_main = False
        self.candidates = []
        for t in terms:
            for alias in t["term"].split(" / "):
                alias = alias.strip()
                if alias:
                    self.candidates.append((alias, t["slug"]))
        self.linked = set()
        self.insertions = []  # (start, end, slug, alias)

    def _abs_offset(self):
        line, col = self.getpos()
        return self._line_offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag == "main":
            self.in_main = True
        if tag in _GLOSSARY_VOID_ELEMENTS:
            return
        classes = set()
        for k, v in attrs:
            if k == "class" and v:
                classes = set(v.split())
        self.tag_stack.append((tag, classes))

    def handle_startendtag(self, tag, attrs):
        if tag == "main":
            self.in_main = True

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = False
        if tag in _GLOSSARY_VOID_ELEMENTS:
            return
        for i in range(len(self.tag_stack) - 1, -1, -1):
            if self.tag_stack[i][0] == tag:
                del self.tag_stack[i:]
                return

    def _excluded(self):
        if not self.in_main:
            return True
        for tag, classes in self.tag_stack:
            if tag in _GLOSSARY_EXCLUDE_TAGS:
                return True
            if classes & _GLOSSARY_EXCLUDE_CLASSES:
                return True
        return False

    def handle_data(self, data):
        if not data or not data.strip() or self._excluded():
            return
        start_abs = self._abs_offset()
        search_from = 0
        while True:
            best = None
            for alias, slug in self.candidates:
                if slug in self.linked:
                    continue
                idx = data.find(alias, search_from)
                if idx == -1:
                    continue
                if best is None or idx < best[0] or (idx == best[0] and len(alias) > len(best[1])):
                    best = (idx, alias, slug)
            if not best:
                return
            idx, alias, slug = best
            self.insertions.append((start_abs + idx, start_abs + idx + len(alias), slug, alias))
            self.linked.add(slug)
            search_from = idx + len(alias)


def auto_link_glossary_terms(html_str, terms):
    """html_str의 <main> 안에서 용어 사전 용어를 찾아 첫 등장에만 링크를 끼워 넣는다.
    (수정한 HTML, 링크가 걸린 slug 목록) 튜플을 돌려준다."""
    parser = _GlossaryLinker(html_str, terms)
    parser.feed(html_str)
    parser.close()
    if not parser.insertions:
        return html_str, []
    out = html_str
    for start, end, slug, alias in sorted(parser.insertions, key=lambda x: -x[0]):
        link = f'<a href="/glossary#{slug}" class="glossary-term-link">{alias}</a>'
        out = out[:start] + link + out[end:]
    return out, sorted({ins[2] for ins in parser.insertions})


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


def iter_header_menu_items(site):
    """메뉴구조 개편 지시서(2026-11-27 오후) §A-1 — header_menu가 바로가기 링크(type:
    "link", 자기 자신이 item)와 정보마당 허브(type: "infohub", items 배열)가 섞여
    있다. 둘 다 순회하며 (group_label_or_None, item) 쌍을 낸다. group_label은 메가
    메뉴 호버 CTA의 "그룹 · 페이지" 눈썹 글자에 쓰인다(build_menu_summaries)."""
    for entry in site["header_menu"]:
        if entry.get("type") == "link":
            yield None, entry
        else:
            for item in entry["items"]:
                yield entry["label"], item


def build_menu_summaries(site, pages, blog_posts):
    """메가 메뉴 초록 CTA 카드용 페이지 요약 — 지시서 2026-11-03.
    런타임에 다른 페이지를 불러오지 않도록 빌드 시점에 전부 미리 계산해서
    헤더 템플릿에 JSON으로 박아 넣는다(9개 항목 전부, 페이지 공통)."""
    summaries = {}
    for group_num, item in iter_header_menu_items(site):
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
            special_text = "거래처 대표님 인터뷰"
        elif slug == "blog":
            count = len(blog_posts["pages"])
            numbers = [{"value": f"{count}편", "label": "발행된 글"}]
        elif slug == "faq":
            count = len(page["items"])
            numbers = [{"value": f"{count}개", "label": "자주 묻는 질문"}]
        elif slug == "glossary":
            numbers = [{"value": "15개", "label": "유선 용어"}]
        else:
            facts = page["sub"]["proof"]["facts"][:2]
            numbers = [{"value": f["value"], "label": f["label"]} for f in facts]

        summaries[slug] = {
            "groupNum": group_num,
            "pageLabel": item["label"],
            "headline": headline,
            "numbers": numbers,
            "specialText": special_text,
        }
    return summaries


_CATEGORY_LABELS = {"blog": "블로그", "guide": "가이드"}


def compute_related_cards(pages, page_categories):
    """디자인 정리 2차 지시서(2026-11-18) §3 — 모든 페이지에 "관련 글" 카드 3장을
    붙인다. page['extra_links']에 적힌 slug(있으면)를 먼저 쓰고, 3장이 안 차면 같은
    분류(블로그/가이드, 지금 페이지 자신은 제외)의 최신 글로 채운다. 그래도 모자라면
    전체 글 중 최신순으로 채운다. 블로그·가이드가 아닌 페이지(서브·용어사전 등)는
    처음부터 블로그 최신 글로 채운다."""
    blog_slugs = [s for s, c in page_categories.items() if c == "blog"]
    blog_slugs.sort(key=lambda s: pages[s].get("date_published", ""), reverse=True)
    guide_slugs = [s for s, c in page_categories.items() if c == "guide"]
    guide_slugs.sort(key=lambda s: pages[s].get("date_published", ""), reverse=True)

    for slug, page in pages.items():
        category = page_categories.get(slug)
        seen = {slug}
        picked = []

        for link in page.get("extra_links") or []:
            s = link.get("slug")
            if s and s in pages and s not in seen:
                picked.append(s)
                seen.add(s)

        same_pool = blog_slugs if category == "blog" else (guide_slugs if category == "guide" else blog_slugs)
        for s in same_pool:
            if len(picked) >= 3:
                break
            if s not in seen:
                picked.append(s)
                seen.add(s)

        if len(picked) < 3:
            fallback = blog_slugs + guide_slugs
            for s in fallback:
                if len(picked) >= 3:
                    break
                if s not in seen:
                    picked.append(s)
                    seen.add(s)

        cards = []
        for s in picked[:3]:
            p = pages[s]
            cat = page_categories.get(s)
            label = _CATEGORY_LABELS.get(cat, "정보")
            if cat == "guide":
                m = re.search(r"·\s*(\d+)/\d+\s*·", p.get("eyebrow", ""))
                if m:
                    label = f"가이드 {m.group(1)}장"
            cards.append({
                "slug": s,
                "category_label": label,
                "title": p.get("h1") or p.get("title", ""),
                "summary": strip_md(p.get("summary", "")),
            })
        page["related"] = cards


def build_info_nav(pages, guide, blog_posts):
    """메뉴구조 개편 지시서(2026-11-27 오후) §A-3 — 정보마당 사이드 메뉴(5개 영역)용
    데이터. 각 영역이 어느 slug들을 "자기 영역"으로 보는지(member_slugs)만 여기서
    한 번 계산해서 모든 템플릿이 같은 기준으로 재사용한다(템플릿에서 가이드·블로그
    전체 slug 목록을 다시 모으지 않게). 영역별 page-specific 내용(소제목·탭·용어
    목록)은 각 템플릿이 그대로 만들어 info_sidebar 매크로의 caller()로 넘긴다."""
    guide_slugs = set(guide["pages"].keys())
    blog_slugs = set(blog_posts["pages"].keys())
    return [
        {
            "key": "startup", "label": "창업자 가이드", "hub_slug": "startup", "expandable": True,
            "member_slugs": {"startup"} | guide_slugs,
            "chapters": pages["startup"]["guide_categories"][0]["chapters"],
        },
        {
            "key": "blog", "label": "블로그", "hub_slug": "blog", "expandable": True,
            "member_slugs": {"blog"} | blog_slugs, "chapters": None,
        },
        {
            "key": "faq", "label": "FAQ", "hub_slug": "faq", "expandable": True,
            "member_slugs": {"faq"}, "chapters": None,
        },
        {
            "key": "glossary", "label": "용어 사전", "hub_slug": "glossary", "expandable": True,
            "member_slugs": {"glossary"}, "chapters": None,
        },
        {
            "key": "stories", "label": "거래처 이야기", "hub_slug": "stories", "expandable": False,
            "member_slugs": {"stories"}, "chapters": None,
        },
    ]


def main():
    site = load_json("site.json")
    base_url = site["base_url"]

    # URL 통일 지시서(2026-11-23) — 구글이 이미 .html 없는 주소를 색인해서, 사이트가
    # 스스로를 부르는 주소(canonical·사이트맵·내부 링크)를 전부 그쪽으로 맞춘다.
    # dist의 파일명(about.html 등)은 그대로 둔다 — GitHub Pages가 /about 요청에
    # about.html을 내준다. page_url은 절대주소(canonical·og:url·sitemap·RSS·llms*용),
    # page_href는 사이트 안 상대 링크(href="...")용이다.
    def page_url(slug):
        return f"{base_url}/" if slug == "index" else f"{base_url}/{slug}"

    def page_href(slug):
        return "/" if slug == "index" else f"/{slug}"

    today = datetime.date.today().isoformat()

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
    # 메뉴구조 개편(2026-11-27) §3 — 왼쪽 목차의 "1~5장 목록"은 startup 허브 페이지의
    # guide_categories[0].chapters를 그대로 쓴다(따로 둔 데이터 없이 재사용).
    guide_chapters = pages["startup"]["guide_categories"][0]["chapters"]
    for slug in guide["pages"]:
        pages[slug]["toc_chapters"] = guide_chapters
        page_categories[slug] = "guide"
        page_source_file[slug] = "content/guide.json"

    # 블로그 포스트(blog_posts.json)도 같은 방식으로 합쳐서 렌더링
    blog_posts = load_json("blog_posts.json")
    pages.update(blog_posts["pages"])
    for slug in blog_posts["pages"]:
        page_categories[slug] = "blog"
        page_source_file[slug] = "content/blog_posts.json"

    # 메뉴구조 개편 지시서(2026-11-27 오후) §A-2·A-3 — 정보마당 허브(/info) 전용 데이터.
    # info_nav는 5개 영역의 소속 slug(사이드 메뉴 공통), latest_posts·faq_preview는
    # 허브 페이지 본문 전용(둘 다 이미 있는 콘텐츠를 그대로 재사용, 새 글 없음).
    info_nav = build_info_nav(pages, guide, blog_posts)
    latest_blog_slugs = sorted(
        blog_posts["pages"].keys(),
        key=lambda s: blog_posts["pages"][s].get("date_published", ""),
        reverse=True,
    )[:3]
    pages["info"]["latest_posts"] = [
        {
            "slug": s,
            "title": blog_posts["pages"][s].get("h1", ""),
            "intro": blog_posts["pages"][s].get("intro", ""),
            "date_published": blog_posts["pages"][s].get("date_published", ""),
        }
        for s in latest_blog_slugs
    ]
    pages["info"]["faq_preview"] = pages["faq"]["items"][:3]

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

    # 편집 원칙(AI 검색 대응 지시서 2026-11-16 §4) — privacy.html과 같은 방식으로,
    # 전용 content 파일 없이 여기서 바로 추가. 메뉴에는 안 넣고 푸터에만 링크한다.
    pages["editorial"] = {
        "template": "editorial.html",
        "title": "콘텐츠 편집 원칙 | ENTER",
        "meta_description": "ENTER(엔터) 유선전문총판이 숫자와 절차를 확인하고 고치는 기준 — 편집 원칙 5가지.",
        "date_published": "2026-11-16",
        "date_modified": "2026-11-16",
    }
    page_categories["editorial"] = "pages"
    page_source_file["editorial"] = "build.py"

    menu_summaries = build_menu_summaries(site, pages, blog_posts)
    compute_related_cards(pages, page_categories)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    env.filters["countable"] = is_countable
    env.filters["compact"] = compact
    env.filters["date_fmt"] = date_fmt
    env.filters["date_fmt_kr"] = date_fmt_kr
    env.filters["date_fmt_dot"] = date_fmt_dot
    env.filters["md_inline"] = md_inline
    env.filters["heading_slug"] = heading_slug
    env.filters["faq_main_entity"] = faq_main_entity
    env.filters["breadcrumb_ld"] = breadcrumb_ld
    env.globals["page_url"] = page_url
    env.globals["page_href"] = page_href
    # 속도 개선 지시서(2026-11-23) §2-② — 터치 기기에서 아예 안 받는 cursor.js/css처럼,
    # <script> 문자열 안에서 동적으로 만드는 태그는 add_cache_busting()의 정규식이 못
    # 잡으므로 템플릿에서 직접 해시를 넣을 수 있게 노출한다.
    env.globals["asset_hash"] = _asset_hash
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

    # CSS·JS 묶기(속도 개선 지시서 2026-11-23 §2-④) — 렌더링 전에 해야 템플릿이
    # bundle_href()로 묶음 파일명을 바로 쓸 수 있다(폰트 서브셋과 달리 렌더된
    # HTML 내용에 의존하지 않아 먼저 해도 된다).
    bundle_hrefs = build_bundles(DIST_DIR)
    env.globals["bundle_href"] = lambda name, ext: bundle_hrefs[(name, ext)]
    print(f"  CSS·JS 묶음: {len(bundle_hrefs)}개 생성")

    sitemap_entries = []  # (slug, lastmod, category)
    all_slugs = list(pages.keys())
    main_text_map = {}  # slug -> <main> 본문 텍스트(llms-full.txt용)

    # 용어 사전 자동 링크(지시서 2026-11-16 §4) — 서비스 페이지(아래 8개)·가이드·블로그
    # 본문에서만 건다. index(광고 무대, 텍스트 거의 없음)·privacy·editorial·blog.html(목록)·
    # glossary 자신은 대상이 아니다.
    _GLOSSARY_LINK_SERVICE_SLUGS = {"why", "about", "products", "start", "settlement", "startup", "faq", "stories"}
    glossary_terms = pages["glossary"]["terms"]
    glossary_link_stats = {}  # slug -> 링크된 term slug 목록

    for slug, page in pages.items():
        # A01-4: date_modified가 없으면 이 항목이 들어있는 content 파일의 git 마지막 커밋일로 대체.
        # AI 검색 대응 지시서 2026-11-16 §3 — 렌더링 전에 미리 구해서 템플릿의 "기준일" 표기·
        # Article/WebPage 스키마 dateModified가 사이트맵 lastmod와 항상 같은 값을 쓰게 한다.
        lastmod = page.get("date_modified") or git_last_modified_date(page_source_file[slug]) or ""
        template = env.get_template(page["template"])
        legal_text = site["legal_footer_about"] if slug == "about" else site["legal_footer"]
        # 거래처이야기4건_홈추가 지시서(2026-11-19) — 홈(why.html)이 stories.html과 같은
        # 인터뷰 매크로를 쓰면서 질문 목록(어떤 질문이 아예 답이 없는지 판단)을 보려면
        # stories 전체 데이터가 필요하다. blog_posts와 같은 방식으로 모든 템플릿에 노출한다.
        html = template.render(site=site, page=page, slug=slug, legal_text=legal_text, blog_posts=blog_posts["pages"], stories=pages["stories"], menu_summaries=menu_summaries, info_nav=info_nav, date_modified=lastmod)
        if slug != "glossary" and (slug in _GLOSSARY_LINK_SERVICE_SLUGS or page_categories.get(slug) in ("guide", "blog")):
            html, linked_slugs = auto_link_glossary_terms(html, glossary_terms)
            if linked_slugs:
                glossary_link_stats[slug] = linked_slugs
        html = add_cache_busting(html)
        out_path = os.path.join(DIST_DIR, f"{slug}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        main_text_map[slug] = extract_main_text(html)
        sitemap_entries.append((slug, lastmod, page_categories[slug]))
        print(f"  생성: {slug}.html")

    if glossary_link_stats:
        total_links = sum(len(v) for v in glossary_link_stats.values())
        print(f"  용어 사전 자동 링크: {len(glossary_link_stats)}개 페이지, 총 {total_links}개")

    # 폰트 서브셋(속도 개선 지시서 2026-11-23 §2-①) — 위에서 dist/*.html을 전부 쓴
    # 뒤라야 "실제로 쓰인 글자"를 모을 수 있다. base.html은 __FONT_SUBSET_HREF__라는
    # 자리표시자로 렌더링돼 있으므로, 서브셋 파일 이름이 정해지면 전체 dist에서
    # 한 번에 치환한다(add_cache_busting과 같은 "렌더 뒤 일괄 치환" 방식).
    font_fonts_dir = os.path.join(DIST_DIR, "static", "fonts", "pretendard")
    font_chars = collect_font_chars(DIST_DIR, STATIC_DIR, CONTENT_DIR)
    font_out_name, font_rebuilt = build_font_subset(font_chars, font_fonts_dir)
    font_href = f"static/fonts/pretendard/{font_out_name}"
    for path in glob.glob(os.path.join(DIST_DIR, "*.html")):
        with open(path, encoding="utf-8") as f:
            html = f.read()
        if FONT_PLACEHOLDER in html:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html.replace(FONT_PLACEHOLDER, font_href))
    # 더는 안 쓰는 예전 굵기별·유니코드 조각 폰트 — 전부 복사된 뒤이므로 지금 지운다.
    old_subset_css = os.path.join(font_fonts_dir, "pretendard-dynamic-subset.css")
    old_subset_dir = os.path.join(font_fonts_dir, "woff2-dynamic-subset")
    if os.path.exists(old_subset_css):
        os.remove(old_subset_css)
    if os.path.isdir(old_subset_dir):
        shutil.rmtree(old_subset_dir)
    print(f"  폰트 서브셋: {font_out_name} ({'새로 생성' if font_rebuilt else '캐시 사용'}, 글자 {len(font_chars)}개, 굵기 {FONT_WEIGHT_RANGE})")

    # 사이트맵 3분리 + 인덱스(A01-3)
    def write_sitemap(filename, entries):
        lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for slug, lastmod, _cat in entries:
            lines.append("  <url>")
            lines.append(f"    <loc>{page_url(slug)}</loc>")
            # URL 통일 지시서(2026-11-23) §2-3 — lastmod가 없으면 빌드 날짜로 채운다(사이트맵
            # 전용 보강; llms-full.txt 등 다른 용도의 date_modified_map은 원래 값 그대로 둔다).
            lines.append(f"    <lastmod>{lastmod or today}</lastmod>")
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
        link = page_url(slug)
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
        f"    <link>{xml_escape.escape(page_url('blog'))}</link>\n"
        f"    <description>{xml_escape.escape(site.get('site_tagline', ''))}</description>\n"
        + "\n".join(item for _pub, item in rss_items) + "\n"
        "  </channel>\n"
        "</rss>\n"
    )
    with open(os.path.join(DIST_DIR, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(rss_xml)
    print(f"  생성: rss.xml ({len(rss_items)}개 글)")

    # robots.txt — 전체허용(2026-11-16 수정 지시). 검색·AI 크롤러를 봇별로 따로 묶을 필요
    # 없이 User-agent: * 한 줄로 전부 허용한다(Disallow 없음).
    # site.noindex가 true면(실도메인 확정 전 임시 호스팅 단계) 크롤링 자체를 막음
    if site.get("noindex"):
        robots = "User-agent: *\nDisallow: /\n"
    else:
        robots = (
            "User-agent: *\n"
            "Allow: /\n"
            f"\nSitemap: {site['base_url']}/sitemap_index.xml\n"
        )
    with open(os.path.join(DIST_DIR, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots)
    print("  생성: robots.txt")

    # llms.txt + llms-full.txt(AI 검색 대응 지시서 2026-11-16 §2) — 손으로 쓰지 않고
    # site.json·pages·guide·blog_posts 데이터와 위에서 모은 main_text_map에서 그대로 만든다.
    date_modified_map = {s: lm for s, lm, _cat in sitemap_entries}

    llms_lines = [
        f"# {site['site_name']} 유선전문총판 ({site['domain_display']})",
        "",
        f"> {site['site_name']} 유선전문총판은 (유)위드컴퍼니 도매영업팀이 운영하는 유선(인터넷·IPTV) 도매 브랜드입니다. "
        "2010년부터 SKT·SK브로드밴드·LG U+·KT·스카이라이프·LG헬로비전 6개 통신사의 인터넷·IPTV·CCTV·가전렌탈·"
        "유심 상품을 전국 판매점과 온라인 셀러 3,000곳에 공급하고, 월 평균 4,000건을 개통합니다(2026년 평균).",
        "",
        "여기서 \"유선\"은 유선 이어폰·케이블 같은 상품이 아니라 인터넷·IPTV 등 통신 회선 상품을 말합니다.",
        "거래처에서는 \"엔터\" 또는 \"위드\"로도 부릅니다.",
        "",
        "판매점·온라인 셀러(사업자) 대상 B2B 서비스입니다. 일반 소비자 가입 상담은 하지 않습니다.",
        "정책 단가는 시간 단위로 바뀌어 사이트에 공개하지 않고, 거래처 정책방으로 매일 아침 안내합니다.",
        "",
        "## 핵심 페이지",
    ]
    llms_lines.append(f"- [정보마당]({page_url('info')}): {pages['info'].get('meta_description', '')}")
    for _group_num, item in iter_header_menu_items(site):
        s = item["slug"]
        llms_lines.append(f"- [{item['label']}]({page_url(s)}): {pages[s].get('meta_description', '')}")

    llms_lines += ["", "## 창업자 가이드"]
    for s, p in guide["pages"].items():
        llms_lines.append(f"- [{p.get('h1', '')}]({page_url(s)}): {p.get('meta_description', '')}")

    llms_lines += ["", "## 블로그"]
    for s, p in sorted(blog_posts["pages"].items(), key=lambda kv: kv[1].get("date_published", ""), reverse=True):
        llms_lines.append(f"- [{p.get('h1', '')}]({page_url(s)}): {p.get('meta_description', '')} ({p.get('date_published', '')})")

    llms_lines += [
        "",
        "## 회사 정보",
        f"- 운영: {site['legal_footer']}",
        "- 정산: 월~일 개통분을 다음 주 수요일 정산서, 금요일 입금. 최근 90회 정산 지연 0회(2026.10.08 기준)",
        f"- 문의: 전화 {site['phone']}",
        f"- [편집 원칙]({page_url('editorial')}): 콘텐츠 확인 기준과 정정 절차",
        "",
        "## 기준일",
        f"- 이 파일 생성일: {today}",
    ]
    llms_txt = "\n".join(llms_lines) + "\n"
    with open(os.path.join(DIST_DIR, "llms.txt"), "w", encoding="utf-8") as f:
        f.write(llms_txt)
    print("  생성: llms.txt")

    llms_full_lines = [llms_txt, "---", ""]
    for s, p in pages.items():
        llms_full_lines.append(f"## {p.get('title', s)}")
        llms_full_lines.append(f"URL: {page_url(s)}")
        if date_modified_map.get(s):
            llms_full_lines.append(f"기준일: {date_modified_map[s]}")
        llms_full_lines.append("")
        llms_full_lines.append(main_text_map.get(s, ""))
        llms_full_lines.append("")
    llms_full_txt = "\n".join(llms_full_lines)
    with open(os.path.join(DIST_DIR, "llms-full.txt"), "w", encoding="utf-8") as f:
        f.write(llms_full_txt)
    print(f"  생성: llms-full.txt ({len(llms_full_txt):,}자)")

    # CNAME(실도메인 연결 지시서 2026-11-12) — GitHub Pages가 base_url의 퓨니코드 호스트를
    # 커스텀 도메인으로 인식하게 한다. base_url이 아직 placeholder면 만들지 않는다.
    if "REPLACE-WITH-REAL-DOMAIN" not in site["base_url"]:
        domain_host = site["base_url"].split("://", 1)[-1]
        with open(os.path.join(DIST_DIR, "CNAME"), "w", encoding="utf-8") as f:
            f.write(domain_host + "\n")
        print(f"  생성: CNAME ({domain_host})")

    # favicon.ico(GEO 2차 지시서 2026-11-18 §2) — 구글 검색결과 파비콘은 사이트 루트
    # /favicon.ico도 찾는다. static/brand/favicon.ico(16·32·48 멀티 해상도, 크림 바탕)를
    # dist 루트로 복사(CNAME과 같은 방식).
    favicon_ico_src = os.path.join(STATIC_DIR, "brand", "favicon.ico")
    if os.path.exists(favicon_ico_src):
        shutil.copy(favicon_ico_src, os.path.join(DIST_DIR, "favicon.ico"))
        print("  생성: favicon.ico")

    # IndexNow 키 파일(GEO 2차 지시서 §4) — https://api.indexnow.org/indexnow가 소유 확인에
    # 쓰는 "/{key}.txt"(내용=key 그대로)를 dist 루트에 둔다. 실제 POST는 배포(push) 뒤
    # scripts/indexnow_notify.py가 따로 호출한다(배포 실패와 무관하게 독립 실행).
    with open(os.path.join(DIST_DIR, f"{INDEXNOW_KEY}.txt"), "w", encoding="utf-8") as f:
        f.write(INDEXNOW_KEY)
    print(f"  생성: {INDEXNOW_KEY}.txt (IndexNow 키)")

    print(f"\n완료: {len(sitemap_entries)}개 페이지 + sitemap 4개 + rss.xml + robots.txt + llms.txt + llms-full.txt -> dist/")
    if "REPLACE-WITH-REAL-DOMAIN" in site["base_url"]:
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
