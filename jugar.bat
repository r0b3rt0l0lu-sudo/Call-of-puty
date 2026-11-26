@echo off
cd /d "%~dp0"
echo Abre http://localhost:8000 en tu navegador (Ctrl+C para parar)
start http://localhost:8000
python -m http.server 8000
