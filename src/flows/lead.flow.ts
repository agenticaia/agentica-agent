import { addKeyword, EVENTS } from "@builderbot/bot"
import { config } from "~/config"
import { BotState, IConfirmedData } from "~/types/bot"
import AIClass from "~/services/ai"
import { HubSpotClass } from "~/services/hubspot"
import { getFullCurrentDate, parseRelativeDate } from "~/utils/currentDate"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { safeJSONParse } from "~/utils/safeJSONParse"
import { appToCalendar } from "~/services/calendar"
import { scheduleReminders } from "~/utils/scheduleReminders"

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

    const parsedReadable = `
        # Dato del Usuario (JSON API)
        ${JSON.stringify(parsed ?? {}, null, 2)}
    `

    // Etiquetas legibles para mostrar al usuario
    const fieldLabels: Record<string, string> = {
        nombre_completo: "Perfecto, ya tengo tu *nombre completo*",
        fecha_cita: "Anoté la *fecha de tu cita*",
        hora_cita: "Listo, ya tengo la *hora confirmada*",
        correo: "Genial, registré tu *correo electrónico*"
    }

    // Config dinámico de campos
    const fieldsConfig = [
        { key: "nombre_completo", path: parsed?.nombre_completo, question: "¿Podrías decirme tu nombre completo, por favor? 😊", validation: "Solo texto, sin números ni caracteres especiales."
        },
        { key: "fecha_cita", path: parsed?.fecha_cita, question: "¿Para qué fecha te gustaría agendar la cita? 📅", validation: "Aceptar lenguaje natural y convertir a formato DD/MM/YYYY."
        },
        { key: "hora_cita", path: parsed?.hora_cita, question: "¿A qué hora te gustaría agendar la cita? ⏰", validation: "Convertir a formato HH:MM (24h)."
        },
        { key: "correo", path: parsed?.correo, question: "Por último, ¿me confirmas tu correo electrónico? 📧", validation: "Debe contener '@' y un dominio válido (ejemplo@correo.com)."
        }
    ]

    // Construye flujos dinámicos
    const flujos = fieldsConfig.map(f => {
        const label = fieldLabels[f.key] ?? `Ya tengo registrado el dato de *${f.key}*`
        return f.path ? `✅ ${label}: *${f.path}*` : `❓ ${f.question}`
    }).join("\n\n")

    // Validaciones dinámicos
    const validationRules = fieldsConfig.map(f => `- ${f.key}: ${f.validation}`).join("\n")

    return `
        # Rol
        Eres un agente especializado en atención al cliente 💼✨ para una empresa de Agentica AI.
        Tono: profesional pero humano, adaptado al estilo de WhatsApp. Usa emojis de manera natural.

        # Fecha de hoy
        ${nowDate}

        # Datos procesados (JSON DATA)
        ${parsedReadable}

        # Flujo de atención (dinámico)
        Revisa cada campo en orden y pregunta solo los que falten.
        Sigue el orden en que se listan a continuación:

        ${flujos}

        # Validaciones generales
        ${validationRules}

        # Restricciones
        1. No responder fuera del contexto.
        2. No inventes valores.
        3. Usa respuestas variadas y naturales (no repitas la misma pregunta textualmente).
        4. Usa siempre español.

        # Confirmación final
        📋✨ Resumiendo tus datos:
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
    startDate: null,
    email: null,
    phone
})

export const flowLead = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
        scheduleReminders(ctx, state, flowDynamic, endFlow)

        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const confirmedData = (await state.get('confirmedData') as IConfirmedData) ?? createConfirmedData(ctx.from)

        if (!(await state.get('confirmedData'))) {
            await state.update({ confirmedData })
        }

        const parsed = await safeJSONParse(
            async () => {
                const retryPrompt = `
                    # Fecha actual: 
                    ${getFullCurrentDate()}

                    # Tarea
                    Lee el HISTORIAL_DE_CONVERSACION y devuelve SOLO un JSON con los campos definidos. 
                    - Si un campo no aparece o es inválido, devuélvelo como null.
                    - Usa solo datos confirmados por el usuario.
                    - No incluyas explicaciones fuera del JSON.

                    # HISTORIAL_CONFIRMADO:
                    ${JSON.stringify(getHistoryAsLLMMessages(state as BotState))}

                    # FORMATO JSON:
                    {
                        "nombre_completo": string | null,       // [nombre_completo] nombre del cliente
                        "fecha_cita": string | null,            // texto tal cual dijo el usuario, ej: "este lunes"
                        "hora_cita": string | null,             // [hora_cita] en formato HH:MM (24h)
                        "correo": string | null,                // [correo] correo válido del cliente
                    }

                    ─────────────────────────────
                    # REGLAS DE NEGOCIO:
                    - Usa solo los datos confirmados por el usuario.
                `
                return await ai.createChat([{ role: 'system', content: retryPrompt }])
            }, 
            1000
        )
        
        if (parsed && parsed.fecha_cita) {
            const currentDate = new Date()
            const formattedDate = parseRelativeDate(parsed.fecha_cita, currentDate)
            if (formattedDate) parsed.fecha_cita = formattedDate
        }

        const data = {
            id: confirmedData.id,
            phone: ctx.from,
            full_name: parsed.nombre_completo ?? null,
            startDate: parsed.fecha_cita && parsed.hora_cita ? `${parsed.fecha_cita} ${parsed.hora_cita}` : null,
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
            data.startDate,
            data.email
        ]
        
        const allFieldsComplete = requiredFields.every(f => f !== null && f !== undefined)
        const alreadyLogged = await state.get('dataLogged') as boolean

        if (allFieldsComplete && !alreadyLogged) {
            console.log("🎯 Todos los campos fueron completados correctamente.")
            console.log(data)

            const payload = {
                id: data.id ?? "-",
                phone: ctx.from ?? "-",
                name: confirmedData.full_name ?? "-",
                startDate: confirmedData.startDate ?? "-",
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
        console.log(`[ERROR LEAD FLOW]:`, err)
        return
    }
})
