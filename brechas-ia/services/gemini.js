// services/gemini.js
// Toda la comunicación con la API de Gemini vive aquí, separada de las rutas
// de Express. Así, si mañana quisieras cambiar de proveedor de IA (OpenAI,
// Claude, etc.), solo tocas este archivo — las rutas no se enteran del cambio.

// Nota: gemini-2.0-flash fue descontinuado por Google el 1 de junio de 2026.
// Usamos el alias "gemini-flash-latest", que Google actualiza automáticamente
// para apuntar siempre al modelo Flash vigente, evitando que este código se
// rompa cada vez que sacan una versión nueva.
// Modelo principal, y uno de respaldo más liviano que suele tener más
// disponibilidad cuando el principal está saturado por alta demanda.
const MODELOS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

function urlModelo(modelo) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
}

/**
 * Llamada genérica a Gemini. Siempre le pedimos que responda en JSON puro
 * (responseMimeType: application/json) para no tener que parsear texto libre.
 */
async function llamarGemini(prompt, { temperature = 0.4 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No hay GEMINI_API_KEY configurada. Revisa tu archivo .env.');
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  };

  let ultimoError;

  // Probamos cada modelo de la lista en orden. Si uno está saturado (503),
  // pasamos al siguiente en vez de fallarle al usuario de una vez.
  for (const modelo of MODELOS) {
    try {
      const response = await fetch(`${urlModelo(modelo)}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Si Gemini no responde en 20 segundos, cancelamos en vez de dejar
        // al usuario esperando para siempre con el botón congelado.
        signal: AbortSignal.timeout(20000),
      });

      if (response.status === 503) {
        ultimoError = new Error(`El modelo ${modelo} está saturado por alta demanda.`);
        continue; // probamos el siguiente modelo de la lista
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini respondió ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!texto) {
        throw new Error('La respuesta de Gemini vino vacía o con formato inesperado.');
      }

      try {
        return JSON.parse(texto);
      } catch {
        throw new Error('No se pudo interpretar el JSON devuelto por Gemini.');
      }
    } catch (err) {
      ultimoError =
        err.name === 'TimeoutError'
          ? new Error(`El modelo ${modelo} tardó demasiado en responder (más de 20 segundos).`)
          : err;
    }
  }

  // Si llegamos aquí, ningún modelo de la lista funcionó.
  throw new Error(
    `Todos los modelos de IA disponibles están saturados o fallando en este momento. Último error: ${ultimoError.message}`
  );
}

// ---------------------------------------------------------------------
// 1. Evaluar una respuesta contra el comportamiento esperado
// ---------------------------------------------------------------------
async function evaluarRespuesta({ competencia, comportamientoEsperado, pregunta, respuesta }) {
  const prompt = `Eres un evaluador experto de competencias laborales en un programa de entrenamiento corporativo.

Competencia evaluada: "${competencia}"
Comportamiento esperado en un desempeño ideal: "${comportamientoEsperado || 'No especificado, usa tu criterio experto.'}"
Pregunta/caso planteado a la persona: "${pregunta || 'No especificada.'}"
Respuesta de la persona en formación: "${respuesta}"

Evalúa qué tan cerca está esta respuesta del comportamiento esperado para esta competencia.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{
  "score": <entero 1 a 5, donde 1 es "no demuestra la competencia" y 5 es "la domina">,
  "feedback": "<2 a 3 frases explicando el puntaje, en español, tono constructivo>",
  "fortalezas": "<1 frase corta con lo que sí hizo bien>",
  "brechas": "<1 frase corta con lo que le falta para llegar a 5>"
}`;

  const resultado = await llamarGemini(prompt, { temperature: 0.3 });

  const score = Number(resultado.score);
  resultado.score = Number.isFinite(score) ? Math.min(5, Math.max(1, Math.round(score))) : 3;

  return resultado;
}

// ---------------------------------------------------------------------
// 2. Generar automáticamente un caso/pregunta + comportamiento esperado
//    a partir solo del nombre de la competencia
// ---------------------------------------------------------------------
async function generarCaso({ competencia }) {
  const prompt = `Eres un diseñador instruccional experto creando material de entrenamiento corporativo.

Para la competencia "${competencia}", genera:
1. Una descripción breve del comportamiento esperado de alguien que domina esta competencia (1 a 2 frases, en español).
2. Un caso o pregunta abierta (no de opción múltiple) que permita evaluar si una persona demuestra esta competencia en una situación realista de atención a cliente o venta consultiva.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{
  "comportamientoEsperado": "<1 a 2 frases>",
  "pregunta": "<el caso o pregunta abierta, redactado como si se lo dijera un cliente o se planteara como situación>"
}`;

  return llamarGemini(prompt, { temperature: 0.7 });
}

// ---------------------------------------------------------------------
// 3. Generar un resumen ejecutivo de todo el tablero (varias competencias)
// ---------------------------------------------------------------------
async function generarResumen({ nombrePersona, competencias }) {
  const listado = competencias
    .map(
      (c) =>
        `- ${c.nombre}: antes ${c.antes}/5, después ${c.despues ?? 'sin evaluar'}/5`
    )
    .join('\n');

  const prompt = `Eres un líder de entrenamiento corporativo redactando un resumen ejecutivo breve.

Persona en formación: "${nombrePersona || 'la persona en formación'}"
Progreso por competencia:
${listado}

Redacta un resumen ejecutivo de 3 a 4 frases, en español, con tono profesional y directo, que mencione: el avance general, qué competencia mejoró más, y qué competencia necesita más atención. No uses viñetas, escribe en prosa.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{
  "resumen": "<el párrafo>"
}`;

  return llamarGemini(prompt, { temperature: 0.5 });
}

module.exports = { evaluarRespuesta, generarCaso, generarResumen };
