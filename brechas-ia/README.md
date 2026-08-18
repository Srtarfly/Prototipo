# Simulador de Cierre de Brechas de Entrenamiento

Prototipo desarrollado para el Assessment Center de **Practicante Desarrollador Web con enfoque en Inteligencia Artificial** — Universidad Corporativa Claro (UMC) / Overlap Colombia.

## ¿Qué hace esta aplicación?

Permite registrar una persona en formación y las competencias que debe demostrar (por ejemplo, "manejo de objeciones"). Para cada competencia se plantea un caso o pregunta abierta; la persona responde con sus propias palabras, y esa respuesta se envía a un modelo de lenguaje (**Google Gemini**, vía API) que la evalúa y devuelve:

- Un puntaje de 1 a 5.
- Retroalimentación breve.
- Una fortaleza detectada.
- Lo que le falta para dominar la competencia.

Un tablero visual compara, por cada competencia, el nivel **"antes"** (autoevaluación previa, elegida manualmente con un slider) contra el nivel **"después"** (el puntaje que dio la IA tras la evaluación), mostrando qué tanto se cerró la brecha.

Además de evaluar, la IA también puede **proponer el caso automáticamente** (a partir solo del nombre de la competencia) y **redactar un resumen ejecutivo** del progreso de toda la persona en formación.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Front-end | HTML, CSS y JavaScript puro (sin frameworks ni build step) |
| Back-end | Node.js + Express, con `helmet` (cabeceras de seguridad) y `express-rate-limit` (control de tasa) |
| IA | API de Google Gemini (`gemini-2.0-flash`), aislada en `services/gemini.js` |
| Persistencia | `localStorage` del navegador |

## Endpoints de la API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/evaluar` | Recibe una respuesta de la persona en formación y la califica (1-5) con feedback |
| `POST` | `/api/generar-caso` | Recibe solo el nombre de una competencia y devuelve un comportamiento esperado + caso sugeridos |
| `POST` | `/api/resumen` | Recibe el estado de todas las competencias y devuelve un párrafo de resumen ejecutivo |

Las tres rutas están protegidas por un límite de 30 solicitudes cada 10 minutos por IP, para no agotar la cuota gratuita de la API por accidente.

## ¿Por qué esta arquitectura?

La llamada al modelo de IA se hace **desde el backend**, nunca desde el navegador. Si la API key viviera en el JavaScript del front-end, cualquiera podría abrir las herramientas de desarrollador del navegador y robarla. Express actúa como intermediario seguro: recibe la respuesta del usuario, la reenvía a Gemini con la key guardada en una variable de entorno, y devuelve solo el resultado de la evaluación.

## Instalación y ejecución local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar tu API key de Gemini:**
   - Consíguela gratis en [Google AI Studio](https://aistudio.google.com) → "Get API key".
   - Copia el archivo `.env.example` como `.env`:
     ```bash
     cp .env.example .env
     ```
   - Abre `.env` y reemplaza `tu_api_key_aqui` con tu key real.

3. **Levantar el servidor:**
   ```bash
   npm start
   ```

4. Abre `http://localhost:3000` en tu navegador.

## Estructura del proyecto

```
brechas-ia/
├── server.js              # Backend Express: define las rutas y la seguridad
├── services/
│   └── gemini.js          # Toda la comunicación con la API de Gemini, aislada
├── .env.example            # Plantilla de variables de entorno (la key NO va aquí)
├── .gitignore               # Excluye node_modules y .env del repositorio
├── package.json
└── public/
    ├── index.html          # Las 3 secciones: Registro, Evaluación, Tablero
    ├── style.css           # Sistema de diseño (colores, tipografía, animaciones)
    └── app.js              # Estado en localStorage + llamadas al backend
```

## Decisiones de alcance

- El "antes" es una **autoevaluación manual** (slider 1-5) en lugar de otra evaluación de IA, para simplificar el flujo dentro del tiempo disponible del reto. En un contexto real, ese "antes" podría venir de una evaluación diagnóstica previa con el mismo mecanismo de IA.
- La persistencia es `localStorage` (permitido explícitamente en los requisitos técnicos del reto); no se implementó base de datos porque no aporta valor adicional a un prototipo de evaluación.
- El modelo de IA recibe instrucciones explícitas de responder solo en JSON (`responseMimeType: application/json`), lo que evita tener que parsear texto libre con expresiones regulares frágiles.

## Qué le faltaría con más tiempo

- Autenticación y perfiles reales por entrenador/consultor.
- Base de datos persistente (PostgreSQL/MongoDB) para históricos entre sesiones.
- Generación automática de casos por competencia usando IA (hoy se registran manualmente).
- Panel comparativo entre varias personas en formación, no solo una a la vez.
