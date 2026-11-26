# Prompt para el generador de modelos 3D (Museo de Cera)

```
Crea 4 personajes 3D de terror para un juego web (Three.js), tema: MUSEO DE CERA
ABANDONADO "Villa Sombría". Estilo: realismo estilizado oscuro. Cera pálida y
amarillenta con grietas, goteos y zonas derretidas, ojos de cristal brillantes,
ropa antigua (siglo XIX) hecha jirones. Deben inquietar incluso quietos
(proporciones ligeramente erróneas: cuello largo, sonrisa fija, manos grandes).

PERSONAJES (ids de juego entre paréntesis)
1. "La Condesa" (bunny): mujer muy alta, vestido victoriano negro-violeta, cuello
   largo, mitad de la cara derretida, peinado alto, ojos dorados luminosos.
2. "El Verdugo" (teddy): hombre enorme, capucha de cuero negra con punta, hacha,
   torso agrietado con luz naranja por dentro, ojos naranjas luminosos.
3. "El Niño del Espejo" (chicken): niño de ~1.2 m con traje de marinero, cabeza
   ligeramente ladeada, sonrisa de oreja a oreja, ojos grandes blancos luminosos.
4. "El Payaso Pálido" (fox): delgado y muy alto, brazos más largos que las piernas,
   dedos largos, maquillaje corrido, dientes de cera enormes, ojos verdes luminosos.

ESPECIFICACIONES TÉCNICAS
- Formato .glb (glTF 2.0), un archivo por personaje: condesa.glb, verdugo.glb,
  nino.glb, payaso.glb. Escala en metros, pivote en los pies, mirando a +Z.
- Máx. 12.000 triángulos por personaje. Texturas PBR 1024x1024 (albedo, normal,
  roughness). Material de piel con ligera subsuperficie/brillo ceroso.
- Esqueleto humanoide, huesos con nombres estándar: Hips, Spine, Neck, Head,
  Jaw, Eye_L, Eye_R, Shoulder_L/R, Hand_L/R, UpLeg_L/R, Foot_L/R.
- Hueso Jaw independiente que abra de forma muy exagerada (hasta ~90°).
- Morph targets: Jaw_Open, Smile, Melt (derretido progresivo), Eyes_Wide.
- Ojos con material emisivo separado llamado "Eyes_Glow".

ANIMACIONES (clips con estos nombres exactos)
- Idle (bucle): casi inmóvil, respiración imperceptible, cabeza girando despacio.
- Walk (bucle): paso lento, rígido, con tirones de marioneta.
- Run (bucle): carrera desgarbada y rápida.
- Peek (1 vez): asomarse tras una esquina.
- Stare (bucle): inmóvil, cabeza inclinada, mirada fija.
- Twitch (1 vez, 1-2 s): espasmos de cuello y dedos.
- Melt (1 vez, 3 s): se derrite y se reconstruye.
- Jumpscare (1 vez, 1.8 s, cámara en primer plano): uno distinto por personaje.

JUMPSCARES (violentos, con 2-3 frames de glitch y sacudida de cámara; la cara
debe llenar la pantalla en menos de 0.25 s)
- Condesa: el cuello se estira hacia la cámara, la cara se parte en dos,
  mandíbula desencajada, chillido; los ojos se vuelven negros.
- Verdugo: entra de golpe, alza el hacha y la descarga; el torso se abre
  mostrando fuego.
- Niño: salta desde el suelo con la cabeza girada 180°, la gira de golpe
  hacia delante con un chasquido y abre la boca con filas de dientes.
- Payaso: se abalanza con los brazos abiertos, la cara se deforma y se derrite
  mientras grita.

EXTRAS
- Variante "dañada" de cada personaje (más grietas y derretido) para noches avanzadas.
- Vista previa en turntable antes de exportar.
```
