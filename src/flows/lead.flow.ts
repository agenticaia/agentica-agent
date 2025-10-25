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
import { cancelReminders, scheduleReminders } from "~/utils/scheduleReminders"
import { generateServiceId, normalizeData } from "~/utils/helpers"
import { baseAgenticaPrompt } from "~/prompts/bsaeAgentica.prompt"

const hubspot = new HubSpotClass({
    token: config.hubspotToken!,
    endpoint: config.hubspotEndpoint!,
})

const availableSchedules = {
    lunes: ["11:00", "15:00"],
    domingo: ["11:00", "15:00"]
}

const generatePrompt = (history: string, parsed: any = null) => {
    const nowDate = getFullCurrentDate()

    const availableScheduleList = Object.entries(availableSchedules).map(([dia, horas]) => `• *${dia}:* ${horas.join(", ")}`).join("\n")
    const schedulesJSON = JSON.stringify(availableSchedules, null, 2)

    const parsedReadable = `
        # Dato del Usuario (JSON API)
        ${JSON.stringify(parsed ?? {}, null, 2)}
    `

    // Etiquetas legibles para mostrar al usuario
    const fieldLabels: Record<string, string> = {
        // --- Diagnóstico ---
        pregunta_1: "Perfecto, ya registré las *horas que dedicas a responder mensajes*",
        pregunta_2: "Listo, ya tengo tu *nivel de frustración al manejar los mensajes*",
        pregunta_3: "Genial, anoté las *herramientas o métodos que usas actualmente*",
        pregunta_4: "Ok, ya registré las *pérdidas o demoras que mencionaste en tus ventas*",
        pregunta_5: "Perfecto, ya tengo el *porcentaje aproximado de mensajes que se convierten en ventas*",
        pregunta_6: "Listo, registré las *métricas o resultados que más te gustaría conocer*",

        // --- Agendamiento ---
        nombre_completo: "Perfecto, ya tengo tu *nombre completo*",
        cuenta_social: "Listo, ya registré tu *cuenta de IG/Tiktok*",
        fecha_cita: "Perfecto, ya registré la *fecha de tu cita*",
        hora_cita: "Listo, ya tengo la *hora confirmada*",
        tipo_negocio: "Perfecto, ya tengo el *tipo de negocio*",
        ocupacion: "Entendido, registré tu ocupación",
        correo: "Genial, registré tu *correo electrónico*"
    }

    // Config dinámico de campos
    const fieldsConfig = [
        {
            key: "pregunta_1",
            path: parsed?.preguntas_diagnostico?.pregunta_1,
            question: "¿cuántas horas calculas que pasaste solamente respondiendo mensajes en WhatsApp e Instagram? ⏱️",
            validation: "Busca obtener una respuesta numérica o estimada, ej. 'unas 3 horas'."
        },
        {
            key: "pregunta_2",
            path: parsed?.preguntas_diagnostico?.pregunta_2,
            question: "Del 1 al 10, ¿qué tan frustrante es manejar el volumen de conversaciones? 😣",
            validation: "Si el usuario responde, indaga más con algo como: 'Cuéntame sobre la peor parte de gestionar tus redes sociales. ¿Qué es lo que más te drena energía?'"
        },
        {
            key: "pregunta_3",
            path: parsed?.preguntas_diagnostico?.pregunta_3,
            question: "¿Qué herramientas usas actualmente para organizar tus conversaciones? Por ejemplo, Excel, libreta o etiquetas de WhatsApp Business. 🧰",
            validation: "Busca si ya están tratando de solucionar el problema y anota 'hacks' o herramientas mencionadas."
        },
        {
            key: "pregunta_4",
            path: parsed?.preguntas_diagnostico?.pregunta_4,
            question: "¿Has perdido ventas por no poder responder a tiempo? ¿Con qué frecuencia? 💸",
            validation: "Pide una historia real, por ejemplo: 'Paseemos por la última vez que una conversación no terminó en venta. ¿Qué pasó?'"
        },
        {
            key: "pregunta_5",
            path: parsed?.preguntas_diagnostico?.pregunta_5,
            question: "¿Sabes cuántas de tus conversaciones terminan en venta? ¿Cómo lo mides? 📊",
            validation: "Fuerza una métrica: 'Si tuvieras que adivinar, de cada 100 mensajes nuevos, ¿cuántos terminan en una venta?'"
        },
        {
            key: "pregunta_6",
            path: parsed?.preguntas_diagnostico?.pregunta_6,
            question: "Si pudieras ver cualquier métrica de tu operación ahora mismo, ¿cuál sería? 📈",
            validation: "Valida su necesidad de métricas reales: 'Si tuvieras una varita mágica, ¿qué número te gustaría conocer de tu operación?'"
        },
        {
            key: "nombre_completo",
            path: parsed?.nombre_completo,
            question: "¿Podrías decirme tu *nombre completo*, por favor? 😊",
            validation: "Solo texto, sin números ni caracteres especiales."
        },
        {
            key: "cuenta_social",
            path: parsed?.cuenta_social,
            question: "¿Cuál es tu cuenta de *Instagram* o *Tiktok*? 📱",
            validation: "Debe ser un nombre válido de usuario, sin espacios."
        },
        {
            key: "fecha_cita",
            path: parsed?.fecha_cita,
            question: `¿Para qué *fecha* te gustaría agendar la cita? 📅. Aquí tienes los días y horarios disponibles: ${availableScheduleList}`,
            validation: `
                - Aceptar lenguaje natural (por ejemplo: "mañana", "este domingo", "el lunes próximo").
                - Validar que la fecha exista dentro de los horarios disponibles.
                - Si el usuario elige un día sin disponibilidad, sugiere el más cercano con opciones horarias.
                - Ejemplo: "Para mañana tenemos disponible a las 11:00 am o a las 3:00 pm 😊"
                - Convertir la fecha a formato DD/MM/YYYY.
                - Referencia JSON: ${schedulesJSON}
            `
        },
        {
            key: "hora_cita",
            path: parsed?.hora_cita,
            question: "¿A qué *hora* te gustaría agendar la cita? ⏰",
            validation: "Convertir a formato HH:MM (24h)."
        },
        {
            key: "tipo_negocio",
            path: parsed?.tipo_negocio,
            question: "¿Cuál es el *tipo de negocio*? (Moda, Belleza, Otros) 🏷️",
            validation: `
                Solo se aceptan rubros *Moda* o *Belleza*.
                - Si menciona "ropa", "diseño", "outfits" → clasificar como *Moda*.
                - Si menciona "uñas", "cabello", "maquillaje", "spa", "salón" → clasificar como *Belleza*.
                - Si responde "otros", "negocio", "servicio", "emprendimiento" o "mecánica" → pedir que especifique si se acerca más a Moda o Belleza.
            `
        },
        {
            key: "ocupacion",
            path: parsed?.ocupacion,
            question: "Cuéntame un poco más sobre lo que haces o el servicio que ofreces en tu negocio elegido. 💼",
            validation: "Debe describir brevemente la actividad principal del negocio elegido (por ejemplo: 'vendo ropa de mujer', 'hago uñas acrílicas', 'ofrezco asesorías de imagen')."
        },
        {
            key: "correo",
            path: parsed?.correo,
            question: "Por último, ¿me confirmas tu *correo electrónico*? 📧",
            validation: "Debe contener '@' y un dominio válido (ejemplo@correo.com)."
        }
    ]

    // Construye flujos dinámicos
    const flujos = fieldsConfig.map(f => {
        const label = fieldLabels[f.key] ?? `Ya tengo registrado el dato de *${f.key}*`
        if (f.key === "ocupacion" && f.path) return `✅ ${label}`
        return f.path ? `✅ ${label}: *${f.path}*` : `❓ ${f.question}`
    }).join("\n\n")

    // console.log(flujos)

    // Validaciones dinámicos
    const validationRules = fieldsConfig.map(f => `- ${f.key}: ${f.validation}`).join("\n")

    return `
        ${baseAgenticaPrompt}

        # Contexto
        Antes de empezar, saluda al usuario según la hora del día y ofrécele un *agente de IA de prueba gratuito*. Hazlo de forma natural y cercana, como una persona hablando por WhatsApp:
        → Ejemplo: "¡Hola! 👋 ¡Buenos días! Te cuento que podemos darte un *agente de IA gratis de prueba* para que veas cómo funciona y te ayude con tus mensajes 😊."

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
        - *Cuenta IG/Tiktok:* [cuenta_social]
        - *Fecha:* [fecha_cita]
        - *Hora:* [hora_cita]
        - *Correo:* [correo]
        - *Tipo de negocio:* [tipo_negocio]

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
                    - Mejora ortografía, redacción y claridad de las respuestas sin alterar su intención.
                    - Usa solo datos confirmados por el usuario.
                    - No incluyas explicaciones fuera del JSON.

                    # HISTORIAL_CONFIRMADO:
                    ${JSON.stringify(getHistoryAsLLMMessages(state as BotState))}

                    # FORMATO JSON:
                    {
                        "preguntas_diagnostico": {
                            "pregunta_1": string | null,    // [pregunta_1] respuesta del cliente
                            "pregunta_2": string | null,    // [pregunta_2] respuesta del cliente
                            "pregunta_3": string | null,    // [pregunta_3] respuesta del cliente
                            "pregunta_4": string | null,    // [pregunta_4] respuesta del cliente
                            "pregunta_5": string | null,    // [pregunta_5] respuesta del cliente
                            "pregunta_6": string | null     // [pregunta_6] respuesta del cliente
                        },
                        "nombre_completo": string | null,   // [nombre_completo] nombre del cliente
                        "cuenta_social": string | null,     // [cuenta_social] cuenta IG/Tiktok, agregando el signo @, ej:"@facebook"
                        "fecha_cita": string | null,        // texto tal cual dijo el usuario, ej: "este lunes"
                        "hora_cita": string | null,         // [hora_cita] en formato HH:MM (24h)
                        "tipo_negocio": string | null       // [tipo_negocio] Moda, Belleza, Otros
                        "ocupacion": string | null,         // [ocupacion]
                        "correo": string | null             // [correo] correo válido del cliente
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
            socialAccount: parsed.cuenta_social ?? null,
            startDate: parsed.fecha_cita && parsed.hora_cita ? `${parsed.fecha_cita} ${parsed.hora_cita}` : null,
            businessType: parsed.tipo_negocio ?? null,
            occupation: parsed.ocupacion ?? null,
            email: parsed.correo ?? null,
            diagnosticQuestions: {
                question_1: parsed.preguntas_diagnostico?.pregunta_1 ?? null,
                question_2: parsed.preguntas_diagnostico?.pregunta_2 ?? null,
                question_3: parsed.preguntas_diagnostico?.pregunta_3 ?? null,
                question_4: parsed.preguntas_diagnostico?.pregunta_4 ?? null,
                question_5: parsed.preguntas_diagnostico?.pregunta_5 ?? null,
                question_6: parsed.preguntas_diagnostico?.pregunta_6 ?? null,
            }
        }
        
        for (const key in data) {
            if (confirmedData[key] === null && data[key] !== null) {
                confirmedData[key] = data[key]
            }
        }

        await state.update({ confirmedData })

        // console.log(`📌 confirmedData actualizado: ${ctx.from} ${confirmedData.id}`)
        console.log(parsed)
        
        const requiredFields = [
            data.full_name,
            data.socialAccount,
            data.startDate,
            data.businessType,
            // data.occupation,
            data.email,
            // data.diagnosticQuestions.question_1,
            // data.diagnosticQuestions.question_2,
            // data.diagnosticQuestions.question_3,
            // data.diagnosticQuestions.question_4,
            // data.diagnosticQuestions.question_5,
            // data.diagnosticQuestions.question_6,
        ]
        
        const allFieldsComplete = requiredFields.every(f => f !== null && f !== undefined)
        const alreadyLogged = await state.get('dataLogged') as boolean

        if (allFieldsComplete && !alreadyLogged) {
            console.log("✅ Todos los campos fueron completados correctamente.")
            
            const diagnosticQuestionsText = [
                data.diagnosticQuestions.question_1 ? `Pregunta 1: ${data.diagnosticQuestions.question_1}` : null,
                data.diagnosticQuestions.question_2 ? `Pregunta 2: ${data.diagnosticQuestions.question_2}` : null,
                data.diagnosticQuestions.question_3 ? `Pregunta 3: ${data.diagnosticQuestions.question_3}` : null,
                data.diagnosticQuestions.question_4 ? `Pregunta 4: ${data.diagnosticQuestions.question_4}` : null,
                data.diagnosticQuestions.question_5 ? `Pregunta 5: ${data.diagnosticQuestions.question_5}` : null,
                data.diagnosticQuestions.question_6 ? `Pregunta 6: ${data.diagnosticQuestions.question_6}` : null,
            ].filter(Boolean).join(', ')
            
            const finalData = {
                ...data,
                diagnosticQuestions: diagnosticQuestionsText,
            }
   
            console.log(finalData)

            cancelReminders(ctx.from, state)
            await state.update({ dataLogged: true })
            await appToCalendar(normalizeData(data))

            setTimeout(async () => {
                await hubspot.update({
                    phone: ctx.from,
                    updates: {
                        firstname: normalizeData({ full_name: data.full_name }).full_name,
                        email: data.email,
                        product_category: data.businessType.toLowerCase(),
                        instagram_handle: data.socialAccount,
                        subcategoria: data.occupation
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
