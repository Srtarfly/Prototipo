// server.js
// Backend del "Simulador de Cierre de Brechas de Entrenamiento".
// Responsabilidades:
//  1. Servir el front-end estático (carpeta public/).
//  2. Exponer 3 endpoints de IA que hablan con Gemini a través de services/gemini.js.
//  3. Proteger la API key (nunca viaja al navegador) y aplicar seguridad básica.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const gemini = require('./services/gemini');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares de seguridad y utilidades ----------
app.use(helmet({ contentSecurityPolicy: false })); // CSP off para simplificar el dev local
app.use(cors());
app.use(express.json({ limit: '20kb' })); // las respuestas son texto corto, no necesitamos más

// Límite de tasa: evita que alguien golpee la API de Gemini sin control
// (protege tu cuota gratuita). 30 solicitudes cada 10 minutos por IP.
const limitadorIA = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes de IA. Espera unos minutos e intenta de nuevo.' },
});

app.use('/api', limitadorIA);
app.use(express.static('public'));

// ---------- Utilidad: envuelve una ruta async para capturar errores ----------
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- POST /api/evaluar ----------
app.post(
  '/api/evaluar',
  asyncRoute(async (req, res) => {
    const { competencia, comportamientoEsperado, pregunta, respuesta } = req.body;

    if (!competencia || !respuesta || !respuesta.trim()) {
      return res.status(400).json({
        error: 'Faltan datos: se requiere al menos "competencia" y "respuesta".',
      });
    }

    const resultado = await gemini.evaluarRespuesta({
      competencia,
      comportamientoEsperado,
      pregunta,
      respuesta,
    });

    res.json(resultado);
  })
);

// ---------- POST /api/generar-caso ----------
app.post(
  '/api/generar-caso',
  asyncRoute(async (req, res) => {
    const { competencia } = req.body;

    if (!competencia || !competencia.trim()) {
      return res.status(400).json({ error: 'Falta el nombre de la competencia.' });
    }

    const resultado = await gemini.generarCaso({ competencia });
    res.json(resultado);
  })
);

// ---------- POST /api/resumen ----------
app.post(
  '/api/resumen',
  asyncRoute(async (req, res) => {
    const { nombrePersona, competencias } = req.body;

    if (!Array.isArray(competencias) || competencias.length === 0) {
      return res.status(400).json({ error: 'No hay competencias registradas para resumir.' });
    }

    const resultado = await gemini.generarResumen({ nombrePersona, competencias });
    res.json(resultado);
  })
);

// ---------- Manejador de errores centralizado ----------
// Cualquier error lanzado dentro de asyncRoute() termina aquí, en un solo lugar,
// en vez de tener try/catch repetido en cada ruta.
app.use((err, req, res, next) => {
  console.error('Error en la API:', err.message);
  res.status(500).json({ error: 'Ocurrió un error procesando la solicitud.', detalle: err.message });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Advertencia: no encontré GEMINI_API_KEY en tu .env. Crea uno basado en .env.example.');
  }
});
