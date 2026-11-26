# Noches en el Museo de Cera

Juego de terror 3D estilo *Five Nights at Freddy's*, hecho con **Three.js** (incluido en `lib/`). No necesita instalación ni archivos de audio (todo se genera por código).

## Jugar
Abre `index.html` en el navegador, o sirve la carpeta con `python3 -m http.server 8000`.
Añade `?fast` a la URL para noches de ~30 s (pruebas).

## Cómo se juega
Eres el guardia nocturno del **Museo de Cera Villa Sombría**. Sobrevive de las **12 AM a las 6 AM** durante **5 noches**.

| Acción | Control |
|---|---|
| Mirar a los lados | Ratón (o arrastrar el dedo) |
| Puerta izq. / der. | `Q` / `E` |
| Linterna izq. / der. | `A` / `D` |
| Cámaras | `Espacio` o botón inferior |
| Elegir cámara | `1`–`7` o mapa |
| Silenciar llamada | `M` |

**Mecánica de la cera:** la linterna *congela* a las figuras en tu puerta, pero el calor las *derrite* y, tras unos segundos, retroceden. Consume energía. Hay estatuas de adorno con ojos apagados; las que tienen los ojos encendidos se mueven.

## Las figuras
- **El Verdugo**: solo se mueve cuando miras las cámaras.
- **La Condesa**: avanza por la galería oeste.
- **El Niño del Espejo**: galería este; se congela si lo ves en cámara.
- **El Payaso Pálido**: sale corriendo de su vitrina por la galería oeste si lo ignoras.

Cada uno tiene su propio jumpscare. Los modelos son procedurales; para modelos propios, ver `docs/prompt-modelos-3d.md`.
