@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv call python -m venv .venv
.venv\Scripts\python -m pip install -q -r requirements.txt pyinstaller
.venv\Scripts\pyinstaller --noconfirm --onefile --name iPadDisplay --add-data "static;static" server.py
echo.
echo 완료: dist\iPadDisplay.exe
pause
