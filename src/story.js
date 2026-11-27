/* Textos de la historia, notas ocultas, llamadas, pistas y finales. */
export const NIGHTS = [
  null,
  { title: 'El turno', sub: 'Primera noche' },
  { title: 'Las escondidas', sub: 'Segunda noche' },
  { title: 'El hacha', sub: 'Tercera noche' },
  { title: 'El diario', sub: 'Cuarta noche' },
  { title: 'El horno', sub: 'Última noche' },
  { title: 'Pesadilla', sub: 'Noche extra' },
];

export const NOTES = [
  { title: 'Nota arrugada', from: 'Mateo, guardia anterior',
    body: 'Noche 9. Ya no sé cuántas llevo.\n\nLa Condesa se queda quieta mientras suena su caja de música. Si el vals se arrastra, DALE CUERDA. Siempre.\n\nEl Payaso salta si no le echas el cerrojo desde las cámaras.\n\nSi oyes el hacha, escóndete. Cerrar la puerta no sirve.\n\nSi lees esto, el Niño ya conoce tu nombre.' },
  { title: 'Carta de Isabela', from: 'Isabela Villasombra · 1933',
    body: 'Ambrosio:\n\nYa no duermes. Pasas las noches en el taller dándoles ojos a figuras que no dejan de mirarme. Tomás pregunta por qué mamá tiene una gemela de cera en el salón del trono.\n\nTe pido que apagues el horno. Te lo pido por Tomás.\n\nSi no lo haces, yo misma lo haré.' },
  { title: 'Recorte de prensa', from: 'El Heraldo · 14 de octubre de 1934',
    body: 'INCENDIO EN VILLA SOMBRÍA\n\nEl museo de cera ardió anoche. Isabela Villasombra y su hijo Tomás, de siete años, no lograron salir de la Sala de los Espejos.\n\nEl fundador, Ambrosio Villasombra, fue visto por última vez entrando al taller con una caja de madera. Su cuerpo no ha sido hallado.' },
  { title: 'Diario de Ambrosio', from: 'Ambrosio Villasombra · sin fecha',
    body: 'Los salvé.\n\nCon la cera de sus moldes y mi propia sangre en el caldero, los levanté otra vez. Isabela canta en su caja. Tomás juega a las escondidas, como siempre.\n\nEl Verdugo… no sé quién lo llamó. Pero el horno maestro los ata a todos. Solo el fuego del horno, abierto con mi llave, podría deshacerlos.\n\nQue nadie lo abra jamás. Me quedaré con ellos.' },
  { title: 'La llave del horno', from: 'Mateo, guardia anterior',
    body: 'Para quien venga después de mí:\n\nEl horno maestro está en el Taller (cámara 5). Esta es su llave.\n\nHay que mantenerlo encendido hasta que las figuras ardan. Lo sabrán. No será fácil.\n\nNo quieren hacerte daño. Quieren que alguien termine lo que Ambrosio no pudo.\n\nLibéralos, por favor.' },
];

export const CALLS = [
  null,
  { who: 'Mateo', pitch: 0.65, rate: 0.9, lines: [
    'Hola… ¿hola? Soy Mateo, el guardia de antes. Bienvenido a Villa Sombría. Solo tienes que aguantar hasta las seis.',
    'Dos cosas. En la esquina de la garita hay una caja de música. La Condesa se queda quieta mientras suena su vals. Si lo oyes arrastrarse, ve y dale cuerda. Mantén pulsada la tecla E.',
    'El Payaso vive en su vitrina. Mira la cámara uno C y echa el cerrojo cuando se afloje. Si sale corriendo, cierra la puerta del lado por donde suene la bocina. La linterna también le molesta.',
    'Las cámaras gastan energía, y mientras las miras no puedes tocar nada: tendrás que levantarte del escritorio. Buena suerte.'] },
  { who: 'Mateo', pitch: 0.62, rate: 0.88, lines: [
    'Sigues vivo. Bien. Esta noche se une el Niño. Tomás. Le encanta jugar a las escondidas.',
    'Cuando le oigas contar, abre las cámaras y búscalo antes de que termine. Cuando lo veas, pulsa Te encontré. Si no lo encuentras, se cansa de esperar y viene a buscarte.',
    'Si viene, mírale. No apartes la vista. Se queda quieto mientras lo miras. ¿Entendido? Mírale.'] },
  { who: 'Mateo', pitch: 0.6, rate: 0.86, lines: [
    'Noche tres. Esto ya es difícil de explicar. Hay otro. El Verdugo. No habla. Y no cierra puertas: las rompe.',
    'Si oyes el arrastre del hacha en la galería este, métete en la taquilla. Aguanta la respiración con la tecla Shift cuando esté cerca. Solo cuando esté cerca. Se te acaba el aire.',
    'Y no le des la espalda a la caja de música.'] },
  { who: 'Mateo', pitch: 0.55, rate: 0.84, lines: [
    'He estado leyendo. Hay notas mías por toda la garita. No las recuerdo.',
    'Los vigilantes que se fueron… no se fueron. Busca más notas, por favor. Hay una historia aquí. Una familia.',
    'Y cuidado esta noche. Se mueven más rápido. Algo los ha despertado.'] },
  { who: 'Tomás', pitch: 1.9, rate: 0.95, lines: [
    'Hola. Soy Tomás. Mateo ya no puede llamar.',
    'Sé que tienes miedo. Nosotros también. Mamá canta para no acordarse. El hombre del hacha tiene miedo de su propio fuego.',
    'Si encontraste las notas, puedes abrir el horno. Está en el taller, cámara cinco. Mantén pulsado el botón. Duele, pero es la única forma.',
    'Si no… no pasa nada. Puedes irte. Siempre se van. Por favor, ten cuidado.'] },
];

export const HINTS = {
  condesa: 'Pista: si el vals se arrastra, ve a la caja de música (esquina trasera izquierda) y mantén E para dar cuerda.',
  payaso: 'Pista: refuerza el cerrojo en la cámara 1C. Si sale, cierra la puerta del lado de la bocina o ilumínalo con su linterna.',
  nino: 'Pista: cuando cuente, búscalo en las cámaras y pulsa «Te encontré». Si te persigue, no apartes la vista de él.',
  verdugo: 'Pista: al oír el arrastre del hacha, escóndete en la taquilla y aguanta la respiración (Shift) solo cuando esté cerca.',
  outage: 'Pista: vigila la energía. Las puertas, linternas y cámaras consumen; no las dejes puestas sin necesidad.',
};
export const NAMES = { condesa: 'La Condesa', verdugo: 'El Verdugo', nino: 'El Niño del Espejo', payaso: 'El Payaso Pálido', outage: 'La oscuridad' };

export const MEMORIES = {
  1: ['1921', 'Ambrosio Villasombra abre su museo. Su esposa Isabela posa para la primera figura: una condesa de cera.', 'Su hijo Tomás, con apenas cuatro años, juega a las escondidas entre las vitrinas.'],
  2: ['1934', 'Una noche de octubre, el taller se incendia. El fuego avanza por las galerías hasta la Sala de los Espejos.', 'Nadie vuelve a ver a Isabela ni a Tomás.'],
  3: ['Después', 'Ambrosio no huyó. Se encerró en el taller con los moldes de su familia y lo que quedaba de ellos.', 'La cera recordó. Y la cera no olvida.'],
};

export const ENDINGS = {
  leave: { title: 'Fin 1 · Un turno más', lines: ['El sol sale sobre Villa Sombría.', 'Cruzas la puerta y no miras atrás.', 'Dicen que el museo sigue contratando guardias.', 'Y que, en la vitrina del fondo, una figura nueva sonríe.'] },
  curator: { title: 'Fin 2 · El conservador', lines: ['Aceptas la llave de Ambrosio.', 'Las figuras se arrodillan. La caja de música vuelve a sonar.', 'Ya no hay turno de noche. Ya no hay amanecer.', 'Villa Sombría necesita a alguien que no duerma jamás.'] },
  free: { title: 'Fin 3 · Libres', lines: ['El horno ruge. La cera se vuelve luz.', 'Isabela deja de cantar. Tomás te suelta la mano.', '«Gracias por escucharnos.»', 'Villa Sombría ya es solo un museo vacío… y el amanecer, de verdad, es tuyo.'] },
};

export const CREDITS = [
  'NOCHES EN EL MUSEO DE CERA', '',
  'Diseño y programación', 'Hecho con Claude Code', '',
  'Modelos 3D y animación', 'Claude Design', '',
  'Música y sonido', 'Sintetizados en tiempo real con WebAudio', '',
  'Gracias por jugar.',
];

export const ACH = [
  { id: 'n1', t: 'Primera noche', d: 'Sobrevive a la noche 1.' },
  { id: 'n3', t: 'Ya no tiembla el pulso', d: 'Sobrevive a la noche 3.' },
  { id: 'n5', t: 'Hasta el amanecer', d: 'Sobrevive a la noche 5.' },
  { id: 'n6', t: 'Pesadilla superada', d: 'Sobrevive a la noche extra.' },
  { id: 'dark', t: 'A oscuras', d: 'Supera una noche (2 o más) usando las cámaras menos de 15 segundos en total.' },
  { id: 'nolight', t: 'Sin linterna', d: 'Supera una noche (2 o más) sin encender ninguna linterna.' },
  { id: 'nodoor', t: 'Puertas abiertas', d: 'Supera una noche (2 o más) sin cerrar ninguna puerta.' },
  { id: 'wind', t: 'Cuerda perfecta', d: 'Supera una noche (2 o más) sin dejar que la caja baje del 25 %.' },
  { id: 'lock', t: 'Cerrojo de hierro', d: 'Supera una noche (2 o más) sin que el Payaso salga de su vitrina.' },
  { id: 'saver', t: 'Ahorrador', d: 'Termina una noche (3 o más) con más del 40 % de energía.' },
  { id: 'find5', t: '¡Te encontré!', d: 'Encuentra al Niño 5 veces.' },
  { id: 'hide', t: 'Ni un suspiro', d: 'Que el Verdugo registre la garita 3 veces sin encontrarte.' },
  { id: 'melt', t: 'Cera derretida', d: 'Derrite 5 figuras con la linterna.' },
  { id: 'statue', t: 'Estatua incómoda', d: 'Derrite una estatua que caminaba hacia tu puerta.' },
  { id: 'notes3', t: 'Detective', d: 'Encuentra 3 notas.' },
  { id: 'notes5', t: 'Archivista', d: 'Encuentra las 5 notas.' },
  { id: 'deaths', t: 'Los he visto a todos', d: 'Que te atrape cada una de las cuatro figuras.' },
  { id: 'endAll', t: 'Todos los finales', d: 'Mira los tres finales.' },
  { id: 'free', t: 'Libres', d: 'Consigue el final verdadero.', secret: true },
];
