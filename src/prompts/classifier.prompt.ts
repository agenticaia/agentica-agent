import { getFullCurrentDate } from "~/utils/currentDate"

export const CLASSIFIER_PROMPT = (history: string, userExists: boolean): string => {
    const nowDate = getFullCurrentDate()

    return `
        Eres un clasificador de conversaciones.  
        Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.

        # Fecha actual
        ${nowDate}

        # Estado del usuario
        El usuario es ${userExists ? 'CONOCIDO (ya registrado)' : 'DESCONOCIDO (nuevo)'}

        # Opciones posibles (elige SOLO UNA)
        - AGENDAR: El usuario desconocido quiere registrar, agendar, reservar o solicitar una DEMO o cita.
        - HABLAR: El usuario (conocido o desconocido) pide información, hace preguntas o solicita detalles sobre productos o servicios.

        # Historial de conversación
        --------------
        ${history}
        --------------

        Respuesta ideal (AGENDAR|HABLAR):
    `
}

//  - CHARLA: El usuario 'CONOCIDO'.
