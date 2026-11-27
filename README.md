# Noches en el Museo de Cera

Juego de terror 3D en primera persona estilo *Five Nights at Freddy's*, hecho con **Three.js**.
Eres el guardia nocturno del **Museo de Cera «Villa Sombría»**. Sobrevive de las 12 AM a las 6 AM durante 5 noches
(más una noche extra «Pesadilla») y descubre qué pasó de verdad con la familia Villasombra.

## Jugar
Necesita un servidor local (carga modelos `.glb`):

```bash
python3 -m http.server 8000     # y abre http://localhost:8000
```

`?fast` acorta las noches (pruebas) · `?debug` expone `window.__g` · `?nolock` desactiva el bloqueo del ratón.

## Controles
| Acción | Control |
|---|---|
| Moverte / mirar | `WASD` / ratón |
| Interactuar (puertas, linternas, caja de música, taquilla, teléfono, notas, archivo) | `E` o clic |
| Cámaras | `Espacio` junto al escritorio (o `E` en el monitor); `1`–`7` para elegir; `F` = «¡Te encontré!» |
| Aguantar la respiración (en la taquilla) | `Shift` |
| Pausa | `Esc` · Silenciar llamada: `M` |

Las cámaras **no se pueden usar a la vez que las puertas/linternas**: hay que levantarse del escritorio y caminar hasta los paneles.

## Las figuras (cada una con su ruta, su pista sonora y su contramedida)
| Figura | Mecánica | Pista | Qué hacer |
|---|---|---|---|
| **La Condesa** | Su posición depende de la carga de una caja de música | El vals se ralentiza y desafina; tacones | Dar cuerda (mantener `E`) en la esquina trasera |
| **El Payaso Pálido** | Cerrojo de su vitrina; si cede, corre por la galería oeste o este | Melodía de caja sorpresa que se acelera; golpes; **bocina** | Cámara 1C → reforzar cerrojo; cerrar la puerta de la bocina o iluminarlo |
| **El Niño del Espejo** | Juega a las escondidas en las cámaras; si pierdes, te persigue por la garita | Cuenta atrás infantil, pelota | Encontrarlo y pulsar «¡Te encontré!»; si viene, **mirarle** |
| **El Verdugo** | Rompe la puerta a hachazos (cerrarla no sirve) y registra la garita | Arrastre de metal, hachazos, respiración | Esconderte en la taquilla y aguantar el aire solo cuando esté cerca |

Además hay **estatuas de adorno** (ojos apagados), **sustos falsos** que no matan (golpes, susurros, teléfono fantasma…)
**sonidos fantasma** (algunos son señuelos que imitan una pista real) y la **linterna**, que derrite al Payaso en la puerta pero gasta energía. Si te quedas sin energía, la Condesa te encuentra.
La dificultad sube cada noche (cada figura se activa en una noche distinta: Condesa+Payaso → Niño → Verdugo).

**Estatuas que caminan** (desde la noche 3): algunas de las estatuas de adorno avanzan hacia tus puertas, pero solo cuando no las miras
(ni tú ni una cámara). Si una llega, te gasta energía hasta que la iluminas con la linterna de ese lado y se derrite.

**Logros**: 19 (menú → Logros, tecla `L`), con avisos en pantalla al desbloquearlos.

## Historia y finales
Cada noche aparece una **nota oculta** en la garita (5 en total) y recibes una llamada que va revelando la historia.
Tras las noches 1–3 hay cinemáticas de «recuerdo». Tres finales:
1. **Un turno más** (por defecto), 2. **El conservador** (si tienes 3+ notas y aceptas la llave),
3. **Libres** (final verdadero: las 5 notas + encender el horno en la cámara 5 la noche 5).

## Estructura
`src/` (`game.js` bucle y flujo, `ai.js` mecánicas, `world.js` mapa y garita, `models.js` personajes `.glb`,
`audio.js` motor de sonido 3D, `cinematics.js`, `story.js`) · `models/` (8 `.glb`) · `docs/` (sonidos, prompts de Design).
