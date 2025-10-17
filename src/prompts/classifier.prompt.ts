import { getFullCurrentDate } from "~/utils/currentDate"

export const CLASSIFIER_PROMPT = (history: string, userExists: boolean) => `
Eres un clasificador de conversaciones.  
Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.

# Fecha de hoy
${getFullCurrentDate()}

# Estado del usuario: ${userExists ? 'conocido' : 'desconocido'}

# Opciones posibles (elige SOLO UNA)
- TALK: Usuario conocido.
- LEAD: Usuario desconocido.

# Historial de conversación
--------------
${history}
--------------

Respuesta ideal (TALK|LEAD):`
