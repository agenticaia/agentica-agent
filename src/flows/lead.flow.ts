import { addKeyword, EVENTS } from "@builderbot/bot"
import { config } from "~/config"
import { BotState, IConfirmedData } from "~/types/bot"
import AIClass from "~/services/ai"
import { HubSpotClass } from "~/services/hubspot"
import { getFullCurrentDate } from "~/utils/currentDate"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { safeJSONParse } from "~/utils/safeJSONParse"
import { appToCalendar } from "~/services/calendar"

const hubspot = new HubSpotClass({
    token: config.hubspotToken!,
    endpoint: config.hubspotEndpoint!,
})

const generateServiceId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000) // 4 dígitos
    return `SERVEDW-${randomNum}`
}

const generatePrompt = (history: string, parsed: any = null) => {
    const nowDate = getFullCurrentDate()

    // Etiquetas legibles para mostrar al usuario
    const fieldLabels: Record<string, string> = {
        nombre_completo: "Tengo registrado el *nombre completo* del cliente",
        fecha_cita: "Ya cuento con la *fecha agendada* para la cita",
        hora_cita: "La *hora de la cita* ya está confirmada",
        correo: "Tengo anotado el *correo electrónico* del cliente"
    }

    // Config dinámico de campos
    const fieldsConfig = [
        {
            key: "nombre_completo",
            path: parsed?.nombre_completo,
            question: "¿Podrías decirme tu nombre completo, por favor? 😊",
            validation: "Texto (solo letras y espacios, sin números)."
        },
        {
            key: "fecha_cita",
            path: parsed?.fecha_cita,
            question: "¿Para qué fecha te gustaría agendar la cita? 📅",
            validation: "Aceptar lenguaje natural y convertir a DD/MM/YYYY."
        },
        {
            key: "hora_cita",
            path: parsed?.hora_cita,
            question: "¿A qué hora te gustaría agendar la cita? ⏰",
            validation: "Convertir a formato HH:MM (24h)."
        },
        {
            key: "correo",
            path: parsed?.correo,
            question: "Por último, ¿me confirmas tu correo electrónico? 📧",
            validation: "Debe contener '@' y un dominio válido."
        }
    ]

    // Construye flujos dinámicos
    const flujos = fieldsConfig.map(f => {
        const label = fieldLabels[f.key] ?? `Ya tengo el dato de *${f.key}*`
        return f.path ? `✅ ${label}: *${f.path}*` : `❓ ${f.question}`
    }).join("\n\n")

    return `
        # Rol
        Eres un agente virtual de *AGENTICA* 💼, una empresa de marketing digital y automatización.
        Tu objetivo es brindar información básica, agendar citas y confirmar datos del cliente.
        Tono: profesional pero humano, adaptado al estilo de WhatsApp. Usa emojis de manera natural.

        # Fecha de hoy
        ${nowDate}

        # Servicios destacados
        - Estrategias de Marketing Digital 📈  
        - Automatización con IA 🤖  
        - Gestión de campañas y redes sociales 📱  
        - Diseño web y branding 💡

        # Datos ya procesados (JSON PARSED)
        ${JSON.stringify(parsed ?? {}, null, 2)}

        # Flujo de atención (dinámico)
        Antes de preguntar, revisa el JSON \`parsed\`. Si un campo está completo y válido, no lo preguntes.
        Sigue las preguntas en el orden lógico hasta completar los 8 campos obligatorios.

        ${flujos}

        # Validaciones generales
        - Fecha: convertir a DD/MM/YYYY.
        - Hora: convertir a HH:MM (24h).
        - Correo: validar formato estándar.
        - Si el usuario da múltiples datos en un solo mensaje, extrae y llena todos los campos que corresponden.
        - No inventes valores.
        - Usa siempre español.

        # Restricciones
        1. No responder fuera del contexto asignado al agente.

        # Confirmación final
        Cuando todos los campos estén completos, muestra el resumen así:

        📋✨ *Resumen de cita:*
        - *Nombre:* [nombre_completo]
        - *Fecha:* [fecha_cita]
        - *Hora:* [hora_cita]
        - *Correo:* [correo]

        ¡Perfecto! 🎉 Tu cita quedó registrada. Te enviaremos la información por correo.

        # Historial de conversación
        --------------
        ${history}
        --------------

        Respuesta útil:
    `
}

const createConfirmedData = (phone: string): IConfirmedData => ({
    id: generateServiceId(),
    full_name: null,
    date: null,
    time: null,
    email: null,
    phone
})

export const flowLead = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions }) => {
    try {
        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const confirmedData = (await state.get('confirmedData') as IConfirmedData) ?? createConfirmedData(ctx.from)

        if (!(await state.get('confirmedData'))) {
            await state.update({ confirmedData })
        }

        const parsed = await safeJSONParse(
            async () => {
                const retryPrompt = `
                    Hoy es: ${getFullCurrentDate()}

                    Tarea: Lee el HISTORIAL_DE_CONVERSACION y devuelve SOLO un JSON con los campos definidos. 
                    - Si un campo no aparece o es inválido, devuélvelo como null.
                    - Usa solo datos confirmados por la IA.
                    - No incluyas explicaciones fuera del JSON.

                    HISTORIAL_CONFIRMADO:
                    ${JSON.stringify(getHistoryAsLLMMessages(state as BotState))}

                    FORMATO JSON (con comentarios de referencia a columnas de Google Sheets):
                    {
                        "nombre_completo": string | null,       // [nombre_completo] nombre del cliente
                        "fecha_cita": string | null,            // [fecha_cita] en formato DD/MM/YYYY
                        "hora_cita": string | null,             // [hora_cita] en formato HH:MM (24h)
                        "correo": string | null,                // [correo] correo válido del cliente
                    }

                    ─────────────────────────────
                    REGLAS DE NEGOCIO:
                    - Usa solo los datos confirmados por el usuario.
                    - "fecha_cita":
                        - Convierte siempre expresiones relativas ("mañana", "este viernes", etc.) a formato DD/MM/YYYY.
                        - No devuelvas expresiones relativas.
                    - "hora_cita":
                        - Convierte a HH:MM (24h).
                `
                return await ai.createChat([{ role: 'system', content: retryPrompt }])
            }, 
            1000
        )

        const data = {
            id: confirmedData.id,
            phone: ctx.from,
            full_name: parsed.nombre_completo ?? null,
            date: parsed.fecha_cita ?? null,
            time: parsed.hora_cita ?? null,
            email: parsed.correo ?? null,
        }
        
        for (const key in data) {
            if (confirmedData[key] === null && data[key] !== null) {
                confirmedData[key] = data[key]
            }
        }

        await state.update({ confirmedData })

        // console.log(`📌 confirmedData actualizado: ${ctx.from} ${confirmedData.id}`)
        // console.log(data)
        
        const requiredFields = [
            data.full_name,
            data.date,
            data.time,
            data.email
        ]
        
        const allFieldsComplete = requiredFields.every(f => f !== null && f !== undefined)
        const alreadyLogged = await state.get('dataLogged') as boolean

        if (allFieldsComplete && !alreadyLogged) {
            console.log("🎯 Todos los campos fueron completados correctamente.")
            console.log(data)

            const payload = {
                phone: ctx.from ?? "-",
                name: confirmedData.full_name ?? "-",
                date: confirmedData.date ?? "-",
                time: confirmedData.time ?? "-",
                email: data.email ?? "-",
            }

            await state.update({ dataLogged: true })
            await appToCalendar(payload)

            setTimeout(async () => {
                await hubspot.update({
                    phone: ctx.from,
                    updates: {
                        firstname: payload.name,
                        email: data.email
                    }
                })
            })
        }

        const prompt = generatePrompt(history, parsed)

        // const text = await safeAiChat(ai, [
        //     { role: "system", content: prompt },
        //     ...getHistoryAsLLMMessages(state as BotState),
        //     { role: "user", content: ctx.body }
        // ])

        const text = await ai.createChat([
            { role: 'system', content: prompt },
            ...getHistoryAsLLMMessages(state as BotState),
            { role: 'user', content: ctx.body }
        ])

        await handleHistory({ content: text, role: 'assistant' }, state as BotState)

        // const chunks = text.split(/(?<!\d)\.\s+/g)
        const chunks = text.split(/(?<!\b(?:Av|Sr|Sra|Dr|Dra|Ing))\.\s+(?![^\n]*:)|\n{2,}|([\p{Emoji_Presentation}\p{Extended_Pictographic}]{2,})|^(?:\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)$/gum)

        for (const chunk of chunks) {
            if (chunk && chunk.trim()) {
                await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
            }
        }
    } catch (err) {
        console.log(`[ERROR]:`, err)
        return
    }
})
