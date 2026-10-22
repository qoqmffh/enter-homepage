# -*- coding: utf-8 -*-
"""
ENTER 블로그 글쓰기 관리자 도구
네이버블로그 스타일 리치텍스트 에디터로 블로그 글을 작성하고,
'발행'을 누르면 자동으로 build.py 실행 + git 커밋/푸시(master, gh-pages)까지 처리합니다.

실행: python admin/app.py
접속: http://localhost:5052
"""
import json
import os
import subprocess
import sys
import uuid
from datetime import date

from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 웹사이트/
CONTENT_DIR = os.path.join(BASE_DIR, "content")
STATIC_DIR = os.path.join(BASE_DIR, "static")
IMAGE_DIR = os.path.join(STATIC_DIR, "blog-images")
PAGES_JSON = os.path.join(CONTENT_DIR, "pages.json")
BLOG_POSTS_JSON = os.path.join(CONTENT_DIR, "blog_posts.json")
BUILD_SCRIPT = os.path.join(BASE_DIR, "build.py")

os.makedirs(IMAGE_DIR, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 이미지 업로드 10MB 제한


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def new_slug():
    today = date.today().strftime("%Y%m%d")
    short = uuid.uuid4().hex[:6]
    return f"blog-{today}-{short}"


@app.route("/")
def index():
    pages = load_json(PAGES_JSON)
    posts = pages["blog"]["posts"]
    return render_template("list.html", posts=posts)


@app.route("/new")
def new_post():
    return render_template("editor.html", post=None, slug=None, tags=["창업", "셀러", "업계", "후기"])


@app.route("/edit/<slug>")
def edit_post(slug):
    blog_posts = load_json(BLOG_POSTS_JSON)
    post = blog_posts["pages"].get(slug)
    if not post:
        return "글을 찾을 수 없습니다", 404
    return render_template("editor.html", post=post, slug=slug, tags=["창업", "셀러", "업계", "후기"])


@app.route("/api/upload-image", methods=["POST"])
def upload_image():
    file = request.files.get("image")
    if not file or not file.filename:
        return jsonify({"error": "이미지 파일이 없습니다"}), 400
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        return jsonify({"error": "png/jpg/gif/webp만 지원합니다"}), 400
    fname = f"{uuid.uuid4().hex}{ext}"
    file.save(os.path.join(IMAGE_DIR, fname))
    return jsonify({"url": f"static/blog-images/{fname}"})


def run_git(args, check=True):
    return subprocess.run(["git"] + args, cwd=BASE_DIR, capture_output=True, text=True, check=check)


@app.route("/api/publish", methods=["POST"])
def publish():
    data = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    tag = data.get("tag") or "창업"
    lead = (data.get("lead") or "").strip()
    body_html = (data.get("body_html") or "").strip()
    slug = data.get("slug") or new_slug()

    if not title:
        return jsonify({"error": "제목을 입력해주세요"}), 400
    if not body_html:
        return jsonify({"error": "본문을 입력해주세요"}), 400

    today = date.today().isoformat()

    # 1. blog_posts.json에 글 내용 저장
    blog_posts = load_json(BLOG_POSTS_JSON)
    existing = blog_posts["pages"].get(slug, {})
    blog_posts["pages"][slug] = {
        "template": "blog_post.html",
        "title": f"{title} | ENTER",
        "meta_description": lead or title,
        "date_published": existing.get("date_published", today),
        "date_modified": today,
        "tag": tag,
        "eyebrow": f"블로그 · {tag}",
        "h1": title,
        "intro": lead,
        "body_html": body_html,
    }
    save_json(BLOG_POSTS_JSON, blog_posts)

    # 2. 블로그 목록(pages.json)에 추가하거나 갱신
    pages = load_json(PAGES_JSON)
    posts = pages["blog"]["posts"]
    found = False
    for p in posts:
        if p.get("slug") == slug:
            p["title"] = title
            p["tag"] = tag
            found = True
            break
    if not found:
        posts.insert(0, {"title": title, "tag": tag, "slug": slug})
    save_json(PAGES_JSON, pages)

    # 3. 빌드
    build_result = subprocess.run(
        [sys.executable, BUILD_SCRIPT], cwd=BASE_DIR, capture_output=True, text=True
    )
    if build_result.returncode != 0:
        return jsonify({"error": "빌드 실패:\n" + build_result.stderr}), 500

    # 4. git 커밋 + 푸시 (master, gh-pages)
    try:
        status = run_git(["status", "--porcelain"])
        if status.stdout.strip():
            run_git(["add", "-A"])
            run_git(["commit", "-m", f"블로그 글 발행: {title}"])
            run_git(["push", "origin", "master"])
        run_git(["branch", "-D", "gh-pages"], check=False)
        run_git(["subtree", "split", "--prefix", "dist", "-b", "gh-pages"])
        run_git(["push", "origin", "gh-pages", "--force"])
    except subprocess.CalledProcessError as e:
        detail = (e.stderr or "") + (e.stdout or "")
        return jsonify({"error": "배포(git) 실패:\n" + detail}), 500

    return jsonify({
        "success": True,
        "slug": slug,
        "url": f"https://qoqmffh.github.io/enter-homepage/{slug}.html",
    })


if __name__ == "__main__":
    print("ENTER 블로그 글쓰기 도구를 시작합니다: http://localhost:5052")
    app.run(port=5052, debug=False)
