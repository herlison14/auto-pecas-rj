@echo off
echo Iniciando Auto Pecas RJ...
cd /d "%~dp0"
start http://localhost:8585
python -m http.server 8585
pause
