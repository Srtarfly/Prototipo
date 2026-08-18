// app.js
// Toda la lógica del front-end. No hay build step: es JS plano a propósito,
// para que sea fácil de leer y explicar en vivo.
//
// Estado (persistido en localStorage bajo la clave "brechas-ia-estado"):
// {
//   persona: { nombre: string },
//   competencias: [
//     {
//       id: string,
//       nombre: string,
//       comportamientoEsperado: string,
//       pregunta: string,
//       antes: number | null,       // autoevaluación previa (1-5)
//       despues: number | null,     // puntaje que dio la IA (1-5)
//       feedback: string | null,
//       fortalezas: string | null,
//       brechas: string | null,
//     }
//   ]
// }

const STORAGE_KEY = 'brechas-ia-estado';

const state = cargarEstado();

// ---------- Referencias al DOM ----------
const $nombre = document.getElementById('input-nombre');
const $listaCompetencias = document.getElementById('lista-competencias');
const $formNueva = document.getElementById('form-nueva-competencia');
const $inputCompetencia = document.getElementById('input-competencia');
const $inputComportamiento = document.getElementById('input-comportamiento');
const $inputPregunta = document.getElementById('input-pregunta');

const $selectCompetencia = document.getElementById('select-competencia');
const $casoActual = document.getElementById('caso-actual');
const $inputRespuesta = document.getElementById('input-respuesta');
const $btnEvaluar = document.getElementById('btn-evaluar');
const $resultado = document.getElementById('resultado-evaluacion');

const $tablero = document.getElementById('tablero');

const $btnCargarDemo = document.getElementById('btn-cargar-demo');
const $btnGenerarCaso = document.getElementById('btn-generar-caso');
const $btnGenerarResumen = document.getElementById('btn-generar-resumen');
const $resumenEjecutivo = document.getElementById('resumen-ejecutivo');
const $toastContainer = document.getElementById('toast-container');

// ---------- Carga / guardado ----------
function cargarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // si el localStorage viene corrupto, arrancamos limpio
  }
  return { persona: { nombre: '' }, competencias: [] };
}

function guardarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function idUnico() {
  return 'c_' + Math.random().toString(36).slice(2, 9);
}

// ---------- Render: nombre ----------
$nombre.value = state.persona.nombre || '';
$nombre.addEventListener('input', () => {
  state.persona.nombre = $nombre.value;
  guardarEstado();
});

// ---------- Render: lista de competencias (sección Registro) ----------
function renderCompetencias() {
  $listaCompetencias.innerHTML = '';

  if (state.competencias.length === 0) {
    $listaCompetencias.innerHTML =
      '<p class="tablero-vacio">Todavía no hay competencias registradas. Agrega la primera abajo.</p>';
  }

  state.competencias.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'competencia-card';
    card.innerHTML = `
      <div class="competencia-card__top">
        <span class="competencia-card__nombre">${escapeHtml(c.nombre)}</span>
        <button class="btn--small" data-eliminar="${c.id}">eliminar</button>
      </div>
      <div class="competencia-card__antes">
        <label>Antes (autoevaluación)</label>
        <input type="range" min="1" max="5" step="1" value="${c.antes ?? 1}" data-antes="${c.id}" />
        <span class="competencia-card__antes-valor">${c.antes ?? 1}</span>
      </div>
    `;
    $listaCompetencias.appendChild(card);
  });

  // Botones eliminar
  $listaCompetencias.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-eliminar');
      state.competencias = state.competencias.filter((c) => c.id !== id);
      guardarEstado();
      renderTodo();
    });
  });

  // Sliders "antes"
  $listaCompetencias.querySelectorAll('[data-antes]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const id = slider.getAttribute('data-antes');
      const comp = state.competencias.find((c) => c.id === id);
      comp.antes = Number(slider.value);
      slider.nextElementSibling.textContent = comp.antes;
      guardarEstado();
      renderTablero();
    });
  });

  renderSelectCompetencias();
}

// ---------- Formulario: nueva competencia ----------
$formNueva.addEventListener('submit', (e) => {
  e.preventDefault();

  const nueva = {
    id: idUnico(),
    nombre: $inputCompetencia.value.trim(),
    comportamientoEsperado: $inputComportamiento.value.trim(),
    pregunta: $inputPregunta.value.trim(),
    antes: 1,
    despues: null,
    feedback: null,
    fortalezas: null,
    brechas: null,
  };

  state.competencias.push(nueva);
  guardarEstado();

  $formNueva.reset();
  renderTodo();
});

// ---------- Render: selector de competencia (sección Evaluación) ----------
function renderSelectCompetencias() {
  const seleccionActual = $selectCompetencia.value;
  $selectCompetencia.innerHTML = '';

  if (state.competencias.length === 0) {
    $selectCompetencia.innerHTML = '<option value="">Registra una competencia primero</option>';
    $casoActual.innerHTML = '<span class="caso-box__vacio">Sin competencia seleccionada.</span>';
    $btnEvaluar.disabled = true;
    return;
  }

  state.competencias.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    $selectCompetencia.appendChild(opt);
  });

  // conserva la selección previa si sigue existiendo
  if (state.competencias.some((c) => c.id === seleccionActual)) {
    $selectCompetencia.value = seleccionActual;
  }

  $btnEvaluar.disabled = false;
  renderCasoActual();
}

$selectCompetencia.addEventListener('change', renderCasoActual);

function renderCasoActual() {
  const comp = competenciaSeleccionada();
  if (!comp) {
    $casoActual.innerHTML = '<span class="caso-box__vacio">Sin competencia seleccionada.</span>';
    return;
  }
  $casoActual.innerHTML = `<strong>Caso:</strong> ${escapeHtml(comp.pregunta || '(sin pregunta registrada)')}`;
}

function competenciaSeleccionada() {
  return state.competencias.find((c) => c.id === $selectCompetencia.value);
}

// ---------- Evaluación con IA ----------
$btnEvaluar.addEventListener('click', async () => {
  const comp = competenciaSeleccionada();
  const respuesta = $inputRespuesta.value.trim();

  if (!comp) return;
  if (!respuesta) {
    mostrarErrorResultado('Escribe una respuesta antes de evaluar.');
    return;
  }

  $btnEvaluar.disabled = true;
  $btnEvaluar.innerHTML = '<span class="spinner"></span>Evaluando con IA...';
  $resultado.hidden = true;

  try {
    const respuestaFetch = await fetch('/api/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competencia: comp.nombre,
        comportamientoEsperado: comp.comportamientoEsperado,
        pregunta: comp.pregunta,
        respuesta,
      }),
      // Si el servidor no responde en 30s, cancelamos en vez de dejar el
      // botón pegado en "Evaluando..." para siempre.
      signal: AbortSignal.timeout(30000),
    });

    const data = await respuestaFetch.json();

    if (!respuestaFetch.ok) {
      throw new Error(data.error || 'Error evaluando la respuesta.');
    }

    comp.despues = data.score;
    comp.feedback = data.feedback;
    comp.fortalezas = data.fortalezas;
    comp.brechas = data.brechas;
    guardarEstado();

    mostrarResultado(data);
    renderTablero();
  } catch (err) {
    const mensaje =
      err.name === 'TimeoutError'
        ? 'El servidor tardó demasiado en responder (más de 30 segundos). Intenta de nuevo.'
        : err.message;
    mostrarErrorResultado(mensaje);
    mostrarToast(mensaje);
  } finally {
    $btnEvaluar.disabled = false;
    $btnEvaluar.innerHTML = 'Evaluar con IA';
  }
});

function mostrarResultado(data) {
  $resultado.hidden = false;
  $resultado.innerHTML = `
    <div class="resultado__score">${data.score}<span>/ 5</span></div>
    <p>${escapeHtml(data.feedback || '')}</p>
    <p><strong>Fortaleza:</strong> ${escapeHtml(data.fortalezas || '—')}</p>
    <p><strong>Le falta:</strong> ${escapeHtml(data.brechas || '—')}</p>
  `;
}

function mostrarErrorResultado(msg) {
  $resultado.hidden = false;
  $resultado.innerHTML = `<p style="color:#e2704f">${escapeHtml(msg)}</p>`;
}

// ---------- Render: tablero de brechas ----------
function renderTablero() {
  $tablero.innerHTML = '';

  if (state.competencias.length === 0) {
    $tablero.innerHTML = '<p class="tablero-vacio">Aún no hay datos para mostrar en el tablero.</p>';
    return;
  }

  state.competencias.forEach((c) => {
    const antes = c.antes ?? 1;
    const despues = c.despues; // puede ser null si no se ha evaluado

    const porcAntes = ((antes - 1) / 4) * 100;
    const porcDespues = despues !== null ? ((despues - 1) / 4) * 100 : null;

    const cerrada = despues !== null && despues >= antes;
    const inicio = porcDespues === null ? porcAntes : Math.min(porcAntes, porcDespues);
    const fin = porcDespues === null ? porcAntes : Math.max(porcAntes, porcDespues);

    const row = document.createElement('div');
    row.className = 'brecha-row';
    row.innerHTML = `
      <div class="brecha-row__top">
        <span class="brecha-row__nombre">${escapeHtml(c.nombre)}</span>
        <span class="brecha-row__estado ${cerrada ? 'cerrada' : ''}">
          ${despues === null ? 'sin evaluar aún' : cerrada ? 'brecha cerrada' : 'brecha abierta'}
        </span>
      </div>
      <div class="brecha-track">
        <div class="brecha-fill" style="left:${inicio}%; width:${fin - inicio}%"></div>
        <div class="brecha-dot brecha-dot--antes" style="left:${porcAntes}%"></div>
        ${porcDespues !== null ? `<div class="brecha-dot brecha-dot--despues" style="left:${porcDespues}%"></div>` : ''}
      </div>
      <div class="brecha-legend">
        <span><span class="legend-dot" style="background:var(--gap-open)"></span>Antes: ${antes}/5</span>
        <span><span class="legend-dot" style="background:var(--accent)"></span>Después: ${despues !== null ? despues + '/5' : '—'}</span>
      </div>
    `;
    $tablero.appendChild(row);
  });
}

// ---------- Utilidad: notificaciones toast ----------
function mostrarToast(mensaje, tipo = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo === 'exito' ? 'toast--exito' : ''}`;
  toast.textContent = mensaje;
  $toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// ---------- Utilidad: evitar inyección de HTML ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Botón: cargar datos de ejemplo (para demo rápida) ----------
$btnCargarDemo.addEventListener('click', () => {
  state.persona.nombre = 'Laura Gómez';
  state.competencias = [
    {
      id: idUnico(),
      nombre: 'Manejo de objeciones',
      comportamientoEsperado:
        'Reconoce la objeción sin ponerse a la defensiva, indaga la causa real detrás del precio, y ofrece una alternativa de valor antes de ceder en descuento.',
      pregunta:
        "Un cliente te dice: 'esto está muy caro, en la competencia lo consigo más barato'. ¿Qué le dices?",
      antes: 2,
      despues: null,
      feedback: null,
      fortalezas: null,
      brechas: null,
    },
    {
      id: idUnico(),
      nombre: 'Conocimiento de producto',
      comportamientoEsperado:
        'Explica características técnicas en términos de beneficios concretos para el cliente, sin usar jerga innecesaria.',
      pregunta: 'El cliente te pregunta por qué debería pagar más por este plan y no por el básico.',
      antes: 3,
      despues: null,
      feedback: null,
      fortalezas: null,
      brechas: null,
    },
    {
      id: idUnico(),
      nombre: 'Uso de herramientas digitales',
      comportamientoEsperado:
        'Navega el CRM con fluidez para registrar la interacción sin hacer esperar al cliente ni perder información relevante.',
      pregunta: 'Termina la llamada con el cliente. ¿Qué haces inmediatamente después y en qué orden?',
      antes: 2,
      despues: null,
      feedback: null,
      fortalezas: null,
      brechas: null,
    },
  ];
  guardarEstado();
  $nombre.value = state.persona.nombre;
  renderTodo();
  mostrarToast('Datos de ejemplo cargados. Ya puedes evaluar con IA.', 'exito');
});

// ---------- Botón: generar caso automáticamente con IA ----------
$btnGenerarCaso.addEventListener('click', async () => {
  const nombreCompetencia = $inputCompetencia.value.trim();

  if (!nombreCompetencia) {
    mostrarToast('Primero escribe el nombre de la competencia.');
    return;
  }

  $btnGenerarCaso.disabled = true;
  $btnGenerarCaso.innerHTML = '<span class="spinner"></span>Generando...';

  try {
    const resp = await fetch('/api/generar-caso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competencia: nombreCompetencia }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'No se pudo generar el caso.');

    $inputComportamiento.value = data.comportamientoEsperado || '';
    $inputPregunta.value = data.pregunta || '';
    mostrarToast('Caso generado. Revísalo y ajústalo si quieres.', 'exito');
  } catch (err) {
    mostrarToast(err.message);
  } finally {
    $btnGenerarCaso.disabled = false;
    $btnGenerarCaso.innerHTML = '✨ Generar con IA';
  }
});

// ---------- Botón: generar resumen ejecutivo con IA ----------
$btnGenerarResumen.addEventListener('click', async () => {
  if (state.competencias.length === 0) {
    mostrarToast('Registra al menos una competencia primero.');
    return;
  }

  $btnGenerarResumen.disabled = true;
  $btnGenerarResumen.innerHTML = '<span class="spinner"></span>Redactando resumen...';

  try {
    const resp = await fetch('/api/resumen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombrePersona: state.persona.nombre,
        competencias: state.competencias.map((c) => ({
          nombre: c.nombre,
          antes: c.antes,
          despues: c.despues,
        })),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'No se pudo generar el resumen.');

    $resumenEjecutivo.hidden = false;
    $resumenEjecutivo.innerHTML = `
      <p class="resumen-ejecutivo__titulo">Resumen ejecutivo · generado con IA</p>
      <p>${escapeHtml(data.resumen)}</p>
    `;
  } catch (err) {
    mostrarToast(err.message);
  } finally {
    $btnGenerarResumen.disabled = false;
    $btnGenerarResumen.innerHTML = '✨ Generar resumen ejecutivo con IA';
  }
});

// ---------- Arranque ----------
function renderTodo() {
  renderCompetencias();
  renderTablero();
}

renderTodo();
