@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul || (echo Python이 설치되어 있지 않습니다. https://www.python.org 에서 설치하세요 ^(설치 시 "Add to PATH" 체크^). & pause & exit /b)
if not exist .venv (
  echo 처음 실행: 필요한 패키지를 설치합니다...
  python -m venv .venv
  .venv\Scripts\python -m pip install -q --upgrade pip
  .venv\Scripts\python -m pip install -q -r requirements.txt
)
.venv\Scripts\python server.py %*
pause
