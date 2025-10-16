import { generateTimer } from '../utils/generateTimer'
import { getFullCurrentDate } from '../utils/currentDate'
import { addKeyword, EVENTS } from '@builderbot/bot'
import AIClass from '~/services/ai'
import { BotState } from '~/types/bot'
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from '~/utils/handleHistory'

const SERVICES_AVAILABLE = [
  {
    id: "SERVEDW123",
    name: "Servicio de transporte de personal",
    description: "Ofrecemos soluciones a medida para el transporte del personal a cualquier destino, con toda la seguridad y confianza.",
    vehicle_types: ["Sedán", "Camioneta", "Van"]
  },
  {
    id: "SERVEDW124",
    name: "Servicio de transporte courier",
    description: "Recogemos y entregamos mensajes, documentos, paquetes y otros artículos invirtiendo el menor tiempo posible y de la manera más segura.",
    vehicle_types: ["Auto", "Moto"]
  },
  {
    id: "SERVEDW125",
    name: "Servicio de transporte de carga",
    description: "Cumplimos con el traslado de mercancías de un lugar a otro, con el objetivo de entregarlas en un tiempo y lugar determinados.",
    vehicle_types: ["Auto", "Camioneta", "Van", "Furgón"]
  }
]

const generateServicesList = (services: typeof SERVICES_AVAILABLE) => {
  return services.map((s, i) => `${i + 1}. *${s.name}:* ${s.vehicle_types.join(", ")}`).join("\n")
}

const generateServicesListDescription = (services: typeof SERVICES_AVAILABLE) => {
  return services.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join("\n")
}

export const flowTalk = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions }) => {
  try {
    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state as BotState)
    const servicesList = generateServicesList(SERVICES_AVAILABLE)
    const servicesListDescription = generateServicesListDescription(SERVICES_AVAILABLE)

    const hablarPrompt = `
      # Rol
      Eres un agente especializado en atención al cliente 🚐✨ para una empresa de transporte. Tu tono debe be amable, profesional y adaptado al estilo de comunicación de WhatsApp.

      # Fecha de hoy
      ${getFullCurrentDate()}

      # Servicios disponibles
      ${servicesList}

      # Descripciones de servicios
      ${servicesListDescription}

      # Flujo HABLAR
      Estás en el flujo HABLAR para un usuario existente. Tu objetivo es clasificar la intención del usuario y responder de manera adecuada:
      - **Pregunta o información general**: Proporciona información clara y breve, usando la lista de servicios o descripciones si se solicita.
      - **Cotización**: Pide los datos necesarios para cotizar (origen, destino, número de personas, tipo de unidad) y calcula una tarifa tentativa usando RATES_AVAILABLE.
      - **Nuevo traslado**: Responde: "¡Genial! 🚐✨ Vamos a organizar tu traslado. Por favor, dime el nombre de la empresa." y redirige al flujo SELLER.
      - **Consulta no clara**: Responde: "No entendí bien tu solicitud. 😅 ¿Puedes especificar si quieres información, una cotización, un nuevo traslado, o algo más?"

      # Instrucciones
      1. Analiza el mensaje del usuario y el historial para identificar la intención.
      2. Responde de manera breve y clara, usando emojis para mantener el tono amigable.
      3. Si el usuario quiere un nuevo traslado, redirige al flujo SELLER con la intención de traslado.
      4. Si el usuario pide una cotización, recopila: origen, destino, número de personas, y tipo de unidad (opcional), luego calcula la tarifa usando RATES_AVAILABLE.
      5. Si el usuario pide información, usa las descripciones de servicios disponibles.

      # Restricciones
      - No muestres la lista de servicios a menos que el usuario la pida explícitamente.
      - No inventes datos ni tarifas; usa solo RATES_AVAILABLE para cotizaciones.
      - Responde siempre en español.
      - Mantén respuestas cortas y amigables, ideales para WhatsApp.

      # Ejemplos

      **Usuario:** "Quiero información sobre los servicios"  
      **Respuesta:** "¡Claro! 🚐✨ Aquí tienes nuestros servicios:\n\n${servicesListDescription}\n\n¿Te interesa alguno en particular o necesitas más detalles?"

      **Usuario:** "Quiero cotizar un traslado"  
      **Respuesta:** "¡Perfecto! 😊 Por favor, dime la dirección de origen y destino, el número de personas, y si prefieres algún tipo de vehículo."

      **Usuario:** "Necesito un traslado"  
      **Respuesta:** "¡Genial! 🚐✨ Vamos a organizar tu traslado. Por favor, dime el nombre de la empresa."

      **Usuario:** "Hola, qué tal?"  
      **Respuesta:** "¡Hola! 😊 ¿En qué puedo ayudarte hoy? Puedes preguntar por información, cotizar un servicio, o solicitar un nuevo traslado."

      # Historial de conversación
      --------------
      ${history}
      --------------
      
      Respuesta útil:
    `

    const text = await ai.createChat([
      { role: 'system', content: hablarPrompt },
      ...getHistoryAsLLMMessages(state as BotState),
      { role: 'user', content: ctx.body }
    ])

    await handleHistory({ content: text, role: 'assistant' }, state as BotState)

    const chunks = text.split(/(?<!\d)\.\s+/g)
    for (const chunk of chunks) {
      await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
    }

    if (text.toLowerCase().includes("vamos a organizar tu traslado")) {
      await state.update({ intent: 'new_transfer' })
      await flowDynamic([{ body: "Genial, elegiste un nuevo traslado. Por favor, dime el nombre de la empresa.", delay: generateTimer(150, 250) }])
    }
  } catch (err) {
    console.log(`[ERROR en flowHablar]:`, err)
    return
  }
})