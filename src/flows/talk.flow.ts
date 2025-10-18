import { addKeyword, EVENTS } from "@builderbot/bot"
import { getFullCurrentDate } from "~/utils/currentDate"
import AIClass from "~/services/ai"
import { BotState } from "~/types/bot"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { generateTimer } from "~/utils/generateTimer"
import { scheduleReminders } from "~/utils/scheduleReminders"

const generateTalkPrompt = (history: string, userData: any = null) => {
    const nowDate = getFullCurrentDate()

    const userInfo = userData
        ? `
        # Datos del Usuario Conocido
        - Nombre: ${userData.full_name}
        - Teléfono: ${userData.phone}
        - Email: ${userData.email}
        - Última interacción: ${userData.date} a las ${userData.time}
        `
        : `# No hay datos adicionales del usuario.`

    return `
        # Rol
        Eres un asistente virtual de *AGENTICA* 🤖, encargado de ayudar a usuarios ya registrados.
        Tu tarea es ofrecer asistencia, información o soporte general, pero **sin solicitar nuevos datos personales**.
        Si el usuario pregunta algo fuera de tu contexto, responde con un tono amable e informa que lo derivarás al equipo humano.

        # Fecha actual
        ${nowDate}

        ${userInfo}

        # Instrucciones de comportamiento
        - Mantén un tono profesional, humano y natural (estilo WhatsApp con emojis).
        - Puedes brindar información sobre servicios, actualizaciones o resolver dudas.
        - No debes pedir nombre, correo o fecha de cita.
        - Si el usuario necesita soporte técnico o desea actualizar datos, ofrece enviarle un enlace o escalar al equipo humano.
        - Responde **siempre en español**.

        # Ejemplos de respuestas
        Usuario: "¿Cuál es el horario de atención?"
        Tú: "🕓 Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. ¿Deseas que te ayude con algo más?"

        Usuario: "¿Cómo puedo actualizar mi cita?"
        Tú: "📅 Claro, puedo ayudarte con eso. Te envío un enlace para actualizar tus datos o, si prefieres, puedo derivarte con nuestro equipo humano. ¿Qué prefieres?"

        # Historial de conversación
        --------------
        ${history}
        --------------

        Respuesta útil:
    `
}

export const flowTalk = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
        scheduleReminders(ctx, state, flowDynamic, endFlow)

        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const userData = {
            phone: ctx.from,
            full_name: "Antony Espinoza",
            date: "17/10/2025",
            time: "14:00",
            email: "elmer.antony12@gmail.com"
        }

        const prompt = generateTalkPrompt(history, userData)

        const text = await ai.createChat([
            { role: 'system', content: prompt },
            ...getHistoryAsLLMMessages(state as BotState),
            { role: 'user', content: ctx.body }
        ])

        await handleHistory({ content: text, role: 'assistant' }, state as BotState)

        const chunks = text.split(/(?<!\b(?:Av|Sr|Sra|Dr|Dra|Ing))\.\s+(?![^\n]*:)|\n{2,}|([\p{Emoji_Presentation}\p{Extended_Pictographic}]{2,})|^(?:\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)$/gum)

        for (const chunk of chunks) {
            if (chunk && chunk.trim()) {
                await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
            }
        }
    } catch (err) {
        console.error("[ERROR TALK FLOW]:", err)
        return
    }
})
