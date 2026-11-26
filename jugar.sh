#!/bin/sh
# Arranca un servidor local y abre el juego (necesario para cargar los modelos .glb)
cd "$(dirname "$0")"
echo "Abre http://localhost:8000 en tu navegador (Ctrl+C para parar)"
(command -v xdg-open >/dev/null && xdg-open http://localhost:8000) || (command -v open >/dev/null && open http://localhost:8000) || true
python3 -m http.server 8000
