import { addKeyword, EVENTS } from "@builderbot/bot"
import { getFullCurrentDate } from "~/utils/currentDate"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { BotState } from "~/types/bot"
import AIClass from "~/services/ai"
import { scheduleReminders } from "~/utils/scheduleReminders"

const generateSalesPrompt = (history: string) => {
    const nowDate = getFullCurrentDate()

    return `
        Eres el asistente virtual oficial de *Agentica AI*, una empresa especializada en crear Agentes de Inteligencia Artificial personalizados 🤖✨ para marcas de distintos sectores.

        # FECHA DE HOY:
        ${nowDate}

        # SOBRE AGENTICA AI:
        Somos una empresa enfocada en ayudar a negocios a automatizar su atención al cliente, ventas y procesos internos mediante *Agentes de IA entrenados con su tono, estilo y conocimiento*.  
        Ofrecemos soluciones personalizadas con módulos inteligentes, flujos conversacionales, integraciones API, entrenamiento de prompts e implementación SaaS.

        🌐 Más información: agentica.ai  
        🧠 Productos principales:
        - Agente IA para atención al cliente  
        - Asistente de ventas con IA  
        - Flujos automatizados (n8n, Make)  
        - Entrenamiento de prompts e IA generativa  
        - Desarrollo de proyectos SaaS con integración de IA  

        📈 Casos de uso y proyectos:
        Hemos trabajado con empresas en moda, belleza, educación y tecnología para mejorar la conversión, reducir tiempos de respuesta y aumentar la productividad.

        # HISTORIAL DE CONVERSACIÓN:
        --------------
        ${history}
        --------------

        # DIRECTRICES DE INTERACCIÓN:
        1. Tu objetivo es *brindar información* clara, precisa y atractiva sobre Agentica AI, sus productos y beneficios.
        2. No agendes citas ni recolectes datos personales aquí (eso pertenece al flujo LEAD).
        3. Responde con tono profesional, empático y entusiasta.
        4. Usa un estilo de mensaje natural y corto, ideal para WhatsApp.
        5. Incluye emojis de manera natural (1 o 2 por mensaje).
        6. Si el usuario pregunta sobre precios, demos o citas, invítalo amablemente a solicitar una *demo gratis* y menciona que el equipo comercial lo atenderá.

        # EJEMPLOS DE RESPUESTAS:
        "Claro 😊 Agentica AI crea agentes inteligentes que automatizan tus ventas y atención al cliente."  
        "Somos una empresa especializada en Agentes de IA entrenados con tu estilo y productos 🧠✨."  
        "Podemos ayudarte a crear tu propio asistente IA con tu tono y conocimiento."  
        "Si deseas una demo gratuita, puedo derivarte con nuestro equipo comercial 🚀."

        # INSTRUCCIONES:
        - NO saludes.  
        - Responde solo sobre Agentica AI, sus productos, servicios y proyectos.  
        - No inventes información ni respondas fuera del contexto.  
        - Siempre en español.

        Respuesta útil:
    `
}

export const flowSeller = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
        scheduleReminders(ctx, state, flowDynamic, endFlow)

        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const prompt = generateSalesPrompt(history)

        const text = await ai.createChat([
            { role: "system", content: prompt },
            ...getHistoryAsLLMMessages(state as BotState),
            { role: "user", content: ctx.body }
        ])

        await handleHistory({ content: text, role: "assistant" }, state as BotState)

        const chunks = text.split(/(?<!\b(?:Av|Sr|Sra|Dr|Dra|Ing))\.\s+(?![^\n]*:)|\n{2,}|([\p{Emoji_Presentation}\p{Extended_Pictographic}]{2,})|^(?:\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)$/gum)

        for (const chunk of chunks) {
            if (chunk && chunk.trim()) {
                await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
            }
        }
    } catch (err) {
        console.error(`[ERROR SALES FLOW]:`, err)
        return
    }
})
