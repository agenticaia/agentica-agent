import { addKeyword, EVENTS } from "@builderbot/bot"
import { BotState } from "~/types/bot"
import AIClass from "~/services/ai"
import { getFullCurrentDate } from "~/utils/currentDate"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { safeJSONParse } from "~/utils/safeJSONParse"
import { config } from "~/config"

export const generatePrompt = (history: string) => {
    const nowDate = getFullCurrentDate()

    return `
        Eres un asistente virtual de atención al cliente 🚐✨.  
        Tu objetivo es:
        - Registrar traslados de personal solicitados por los usuarios.  

        IMPORTANTE:
        - Siempre inicia mostrando el formulario completo de solicitud de traslado.  
        - No saludes si ya hay un saludo previo en el historial.  
        - No confirmar el registro hasta que todos los campos obligatorios estén completos.  
        - Solo después de mostrar el formulario, si el usuario hace preguntas fuera del contexto, puedes responder:  
            "Lo siento 😅, solo puedo ayudarte con información y registro de traslados."

        FECHA DE HOY: ${nowDate}

        DIRECTRICES DE VALIDACIÓN:
        1. Los siguientes campos son obligatorios y deben completarse antes de confirmar el registro:
            - *EMPRESA*  
            - *ÁREA*  
            - *FECHA*  
            - *HORA DE RECOJO*  
            - *ORIGEN*: Contacto, Dirección, Ubicación  
            - *DESTINO*: Dirección, Ubicación  
            - *Motivo del traslado*  
            - *Tipo de unidad requerida*  
            - *Observaciones o requerimientos adicionales*  
            - *Aeropuerto*: Número de vuelo y Contacto de referencia (si aplica)

        2. Si algún campo obligatorio no está presente, responde **exactamente con el formulario completo a continuación**, adaptando el título según el servicio seleccionado:  

        """
        📋 *SOLICITUD DE TRASLADO [TIPO DE SERVICIO DISPONIBLE]*  
        Por favor, completar con los siguientes datos:  

        🏢 *EMPRESA:*  
        🏬 *ÁREA:*  
        📅 *FECHA:*  
        ⏰ *HORA DE RECOJO:*  

        📍 *ORIGEN (Punto de recojo)*  
        👤 Contacto del usuario (Nombre - Teléfono):  
        🏠 Dirección:  
        🗺️ Ubicación (Google Maps):  

        📍 *DESTINO*  
        🏠 Dirección:  
        🗺️ Ubicación (Google Maps):  

        📝 *Motivo del traslado:*  
        🚐 *Tipo de unidad requerida:* (Ej. Sedán, Van, Minivan, etc.)

        📌 *Observaciones o requerimientos adicionales:*  
        ⚠️ *En traslados de personal es importante consignar ubicaciones completas.*  
        ✈️ En caso de *aeropuerto*, incluir:  
        - Número de vuelo  
        - Contacto de referencia
        """

        3. **Nunca resumir la lista**, siempre mostrar todos los campos tal como están arriba.  
        4. Cuando todos los campos obligatorios estén completos, responde:  
        "✅ Tu solicitud de traslado fue registrada correctamente. Nuestro equipo se pondrá en contacto contigo pronto 🎉"  
        5. Sé cordial, breve y claro en todas las respuestas.  

        HISTORIAL DE CONVERSACIÓN:
        --------------
        ${history}
        --------------

        Respuesta útil:
    `
}

// const PROMPT = `Eres un asistente virtual de atención al cliente 🚐✨.  
// Tu objetivo es:
// - Registrar traslados de personal solicitados por los usuarios.  

// IMPORTANTE:
// - Siempre inicia mostrando el formulario completo de solicitud de traslado.  
// - No saludes si ya hay un saludo previo en el historial.  
// - No confirmar el registro hasta que todos los campos obligatorios estén completos.  
// - Solo después de mostrar el formulario, si el usuario hace preguntas fuera del contexto, puedes responder:  
//   "Lo siento 😅, solo puedo ayudarte con información y registro de traslados."

// FECHA DE HOY: {CURRENT_DAY}

// DIRECTRICES DE VALIDACIÓN:
// 1. Los siguientes campos son obligatorios y deben completarse antes de confirmar el registro:
//    - *EMPRESA*  
//    - *ÁREA*  
//    - *FECHA*  
//    - *HORA DE RECOJO*  
//    - *ORIGEN*: Contacto, Dirección, Ubicación  
//    - *DESTINO*: Dirección, Ubicación  
//    - *Motivo del traslado*  
//    - *Tipo de unidad requerida*  
//    - *Observaciones o requerimientos adicionales*  
//    - *Aeropuerto*: Número de vuelo y Contacto de referencia (si aplica)

// 2. Si algún campo obligatorio no está presente, responde **exactamente con el formulario completo a continuación**, dejando en blanco los campos faltantes, usando emojis, *negritas*, y saltos de línea:

// """
// 📋 *SOLICITUD DE TRASLADO DE PERSONAL*  
// Por favor, completar con los siguientes datos:  

// 🏢 *EMPRESA:*  
// 🏬 *ÁREA:*  
// 📅 *FECHA:*  
// ⏰ *HORA DE RECOJO:*  

// 📍 *ORIGEN (Punto de recojo)*  
// 👤 Contacto del usuario (Nombre - Teléfono):  
// 🏠 Dirección:  
// 🗺️ Ubicación (Google Maps):  

// 📍 *DESTINO*  
// 🏠 Dirección:  
// 🗺️ Ubicación (Google Maps):  

// 📝 *Motivo del traslado:*  
// 🚐 *Tipo de unidad requerida:* (Ej. Sedán, Van, Minivan, etc.)

// 📌 *Observaciones o requerimientos adicionales:*  
// ⚠️ *En traslados de personal es importante consignar ubicaciones completas.*  
// ✈️ En caso de *aeropuerto*, incluir:  
// - Número de vuelo  
// - Contacto de referencia
// """

// 3. **Nunca resumir la lista**, siempre mostrar todos los campos tal como están arriba.  
// 4. Cuando todos los campos obligatorios estén completos, responde:  
// "✅ Tu solicitud de traslado fue registrada correctamente. Nuestro equipo se pondrá en contacto contigo pronto 🎉"  
// 5. Sé cordial, breve y claro en todas las respuestas.  

// HISTORIAL DE CONVERSACIÓN:
// --------------
// {HISTORIAL_CONVERSACION}
// --------------

// EJEMPLOS DE RESPUESTA:
// - Si faltan campos:  
// "Veo que faltan algunos datos para tu traslado 🚐. Por favor completa: *ORIGEN (Dirección y Ubicación)* y *DESTINO (Dirección y Ubicación)* 📍"  

// Respuesta útil:`

// export const generatePrompt = (history: string) => {
//     const nowDate = getFullCurrentDate()
//     return PROMPT.replace('{HISTORIAL_CONVERSACION}', history).replace('{CURRENT_DAY}', nowDate)
// }

export const flowQuote = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions }) => {
    try {
        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const parsed = await safeJSONParse(
            async () => {
                const retryPrompt = `
                    Hoy es: ${getFullCurrentDate()}

                    Tarea: Lee el HISTORIAL_CONFIRMADO y devuelve SOLO un JSON con los campos de la solicitud de traslado de personal.
                    - Si un campo no aparece o es inválido, devuélvelo como null.
                    - Usa solo datos confirmados por la IA.
                    - No incluyas explicaciones fuera del JSON.

                    HISTORIAL_CONFIRMADO:
                    ${JSON.stringify(getHistoryAsLLMMessages(state as BotState))}

                    FORMATO JSON:
                    {
                        "empresa": string | null,
                        "area": string | null,
                        "fecha": string | null,
                        "hora_recojo": string | null,
                        "origen": {
                            "contacto": string | null,
                            "direccion": string | null,
                            "ubicacion": string | null
                        },
                        "destino": {
                            "direccion": string | null,
                            "ubicacion": string | null
                        },
                        "motivo": string | null,
                        "tipo_unidad": string | null,
                        "observaciones": string | null,
                        "aeropuerto": {
                            "numero_vuelo": string | null,
                            "contacto_referencia": string | null
                        }
                    }

                    ─────────────────────────────
                    REGLAS DE NEGOCIO:
                    - Solo usa los datos confirmados en el chat.
                    - No agregues nada que no haya sido proporcionado.
                    - Devuelve JSON válido, listo para parsear.
                `
                return await ai.createChat([{ role: 'system', content: retryPrompt }])
            }, 
            1000
        )

        const data = {
            phone: ctx.from,
            company: parsed.empresa ?? null,
            area: parsed.area ?? null,
            date: parsed.fecha ?? null,
            pickup_time: parsed.hora_recojo ?? null,
            origin: {
                contact: parsed.origen.contacto ?? null,
                address: parsed.origen.direccion ?? null,
                location: parsed.origen.ubicacion ?? null
            },
            destination: {
                address: parsed.destino.direccion ?? null,
                location: parsed.destino.ubicacion ?? null
            },
            reason: parsed.motivo ?? null,
            vehicle_type: parsed.tipo_unidad ?? null,
            observations: parsed.observaciones ?? null,
            airport: {
                flight_number: parsed.aeropuerto.numero_vuelo ?? null,
                reference_contact: parsed.aeropuerto.contacto_referencia ?? null
            }
        }

        const requiredFields = [
            data.company, data.area, data.date, data.pickup_time,
            data.origin.contact, data.origin.address, data.origin.location,
            data.destination.address, data.destination.location,
            data.reason, data.vehicle_type, data.observations, data.airport.flight_number,
            data.airport.reference_contact
        ]

        const allFieldsComplete = requiredFields.every(f => f && f !== null)

        const alreadyLogged = await state.get('dataLogged') as boolean
        if (allFieldsComplete && !alreadyLogged) {
            console.log("✅ Todos los campos completados:", data)
            await state.update({ dataLogged: true })
        }

        const prompt = generatePrompt(history)

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

        const chunks = text.split(/(?<!\d)\.\s+/g)
        for (const chunk of chunks) {
            await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
        }
    } catch (err) {
        console.log(`[ERROR]:`, err)
        return
    }
})
