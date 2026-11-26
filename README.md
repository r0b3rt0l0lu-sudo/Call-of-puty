# Cinco Noches en Puty's

Juego de terror 3D estilo *Five Nights at Freddy's* hecho con **Three.js**, sin dependencias de build ni archivos de audio (todo se genera por código).

## Jugar
Abre `index.html` en el navegador (doble clic) o sirve la carpeta:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Cómo se juega
Eres el guardia nocturno. Sobrevive de las **12 AM a las 6 AM** durante **5 noches**.

| Acción | Control |
|---|---|
| Mirar a los lados | Mover el ratón (o arrastrar el dedo) |
| Puerta izq. / der. | `Q` / `E` |
| Luz pasillo izq. / der. | `A` / `D` |
| Cámaras | `Espacio` o botón inferior |
| Elegir cámara | `1`–`7` o mapa |
| Silenciar la llamada | `M` |

## Los animatrónicos
- **Don Teddy** (oso): solo se mueve cuando miras las cámaras.
- **Coni el Conejo**: avanza por el lado izquierdo.
- **Pipa la Pollita**: lado derecho; se congela si la ves en cámara.
- **Capitán Colmillo** (zorro): si ignoras su Cove, sale corriendo por el pasillo oeste.

Todo consume energía (puertas, luces, cámaras). Si llega a 0%… suena una cajita de música.

Truco para probar: añade `?fast` a la URL para que las noches duren 30 s.
