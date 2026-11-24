@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul || (echo Python이 설치되어 있지 않습니다. https://www.python.org 에서 설치하세요 ^(설치 시 "Add to PATH" 체크^). & pause & exit /b)
if not exist .venv\Scripts\python.exe (
  echo 처음 실행: 필요한 패키지를 설치합니다...
  python -m venv .venv
  .venv\Scripts\python -m pip install -q --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo [오류] 패키지 설치에 실패했습니다. python.org 에서 Python 3.13 을 설치한 뒤 다시 실행하세요.
    rmdir /s /q .venv
    pause
    exit /b
  )
)
.venv\Scripts\python server.py %*
pause
