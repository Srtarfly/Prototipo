# Documento breve — Simulador de Cierre de Brechas de Entrenamiento

**Candidato:** Sebastián Camilo Verdugo Clavijo
**Reto:** Assessment Center — Practicante Desarrollador Web con IA · UMC Claro

## 1. Problema que interpreté

Hoy, cuando una persona en formación presenta una evaluación de conocimiento en la UMC, un líder revisa manualmente sus respuestas para decidir si "cerró" la brecha en una competencia. Esto consume tiempo y no deja un histórico claro de la evolución de cada persona. Interpreté que el reto pide automatizar ese primer filtro de evaluación usando IA, y visualizar el progreso de forma que cualquier líder —sin conocimientos técnicos— pueda entenderlo de un vistazo.

## 2. Decisiones técnicas que tomé

- **[Completar: por qué elegiste Node/Express + JS puro en vez de un framework de front-end]**
- Decidí que la llamada al modelo de IA se hiciera desde un backend Express y no desde el navegador, para no exponer la API key.
- Usé `localStorage` para persistencia, ya que el reto lo permite explícitamente y es suficiente para un prototipo de sesión.
- **[Completar: alguna decisión adicional que tomaste al construirlo, por ejemplo cómo definiste las competencias de ejemplo]**

## 3. Cómo integré la IA

La aplicación envía la respuesta abierta de la persona en formación, junto con el comportamiento esperado de la competencia, a la API de **Google Gemini**. El modelo devuelve un JSON estructurado con: un puntaje de 1 a 5, retroalimentación en texto, una fortaleza detectada y una brecha pendiente. Este puntaje se usa como el valor "después" en el tablero comparativo.

**[Completar: menciona aquí un ejemplo concreto — qué pregunta hiciste, qué respuesta diste, y qué evaluó la IA — para poder mostrarlo en vivo]**

## 4. Qué le faltaría con más tiempo

- Generación automática de casos por competencia (hoy se registran manualmente).
- Persistencia en base de datos para históricos entre sesiones y varias personas.
- Autenticación de entrenadores/consultores y roles diferenciados.
- Panel agregado que compare el cierre de brechas entre varias personas en formación a la vez.

---
*Nota: completa los corchetes [Completar: ...] con tus propias palabras antes de entregar — el panel evaluador quiere ver cómo piensas tú, no una respuesta genérica.*
