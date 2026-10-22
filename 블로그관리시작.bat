@echo off
cd /d "%~dp0"
echo ENTER 블로그 글쓰기 도구를 시작합니다...
echo 브라우저에서 http://localhost:5052 로 접속하세요.
python admin\app.py
pause
