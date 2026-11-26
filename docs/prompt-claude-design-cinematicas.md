# Prompt para Claude Design — animaciones extra para cinemáticas y jumpscares

El juego ya usa los 8 `.glb` entregados (Idle, Walk, Run, Peek, Stare, Twitch, Melt y Jumpscare con su `JumpscareCam`).
Las cinemáticas y los jumpscares están implementados **en el motor** con esos clips. Si quieres subir el nivel,
este prompt pide clips y props nuevos que se integran sin cambiar nada del código (basta con añadirlos a cada `.glb`).

```
Mejora los 4 personajes del Museo de Cera (La Condesa, El Verdugo, El Niño del Espejo, El Payaso Pálido).
Mantén EXACTAMENTE los mismos esqueletos, nombres de huesos, materiales, morph targets y los 8 clips actuales.
Añade a cada .glb (y a su variante _Damaged) estos CLIPS NUEVOS, con el mismo esqueleto, 24 fps, nombres exactos:

CLIPS PARA CINEMÁTICAS
- Bow (3 s, 1 vez): reverencia lenta y solemne; termina en pose de rodillas con la cabeza inclinada.
- Kneel_Idle (bucle, 4 s): arrodillado, respiración casi imperceptible, mirada al suelo.
- Wave (3 s, 1 vez): saludo con la mano; en El Niño, una despedida tímida y triste.
- Reach (2.5 s, 1 vez): extiende la mano hacia la cámara (ofrece/pide la mano). El Niño: la mano pequeña abierta.
- Turn_Look (2 s, 1 vez): gira el cuerpo y la cabeza hacia la cámara con una pausa inquietante.
- Dissolve (4 s, 1 vez): se deshace en luz hacia arriba, de los pies a la cabeza (usa el morph Melt y emisión
  creciente en Eyes_Glow); termina con el modelo casi transparente.
- Sit_Idle (bucle): sentado (para una silla de oficina), manos sobre las rodillas, mirando al frente.

JUMPSCARES ADICIONALES (1.6 s, 1 vez, JumpscareCam animada como en el clip actual)
- Jumpscare_Dark: versión "apagón" — todo en penumbra, solo se ven los ojos brillantes y los dientes; entra de lado.
- Jumpscare_Door: embiste desde la puerta de la garita (cámara a la altura de los ojos de un guardia sentado).
- Para cada uno: 2-3 frames de glitch (escala/posición descolocada de la cabeza), mandíbula a ~90°,
  ojos que se vuelven negros (Eyes_Black) y la cara llenando la pantalla en menos de 0.25 s.

PROPS NUEVOS (.glb sueltos, escala en metros, pivote en la base, <3.000 triángulos)
- llave_ambrosio.glb: llave antigua de latón con colgante de cera.
- puerta_horno.glb: puerta de hierro de horno con brasas emisivas animadas (clip Open, 3 s).
- caja_musica.glb: la caja del escritorio, con bailarina de cera animada (clip Spin, bucle).
- pelota_tomas.glb: pelota de trapo, con clip Bounce.
- espejo_sala.glb: marco de espejo ovalado con reflejo agrietado.

Entrega vista previa (turntable) de cada clip antes de exportar.
```

## Cinemáticas implementadas (en motor)
1. **Intro** — recorrido por la galería, la sala del trono y el teléfono que suena.
2. **Recuerdos** (tras las noches 1, 2 y 3) — 1921 (dorado), 1934 (fuego) y «Después» (el taller).
3. **Fin 1 · Un turno más** — amanece; las figuras te miran desde el fondo de la galería.
4. **Fin 2 · El conservador** — aceptas la llave; las figuras se arrodillan; apareces como figura nueva.
5. **Fin 3 · Libres** (verdadero) — el horno, la cera se convierte en luz y Tomás se despide.
