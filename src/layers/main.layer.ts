import { BotContext, BotMethods } from "@builderbot/bot/dist/types"
import { getHistoryParse } from "../utils/handleHistory"
import { CLASSIFIER_PROMPT } from "~/prompts/classifier.prompt"
import AIClass from "~/services/ai"
import { logInfo, logWarn } from "~/utils/logger"
import { cancelReminders, scheduleReminders } from "~/utils/scheduleReminders"
import { globalFlags } from "~/core/globals"
import { flowQuote } from "~/flows/quote.flow"
import { flowTalk } from "~/flows/talk.flow"
import { flowLead } from "~/flows/lead.flow"

const USER_DATABASE = [
  {
    phone: "519120038190",
    empresa: "Proveedy Sac",
    name: "Jesus Alvarez",
    area: "Logística",
    fecha: "2025-09-15",
    hora_recogo: "08:00",
    origen_contacto: "Juan Pérez",
    origen_direccion: "Av. La Marina 123, San Miguel",
    destino_direccion: "Aeropuerto Jorge Chávez",
    motivo_traslado: "Viaje de negocios",
    tipo_unidad_requerida: "Van",
    observaciones: "Requiere factura",
    aeropuerto_vuelo: "LATAM123",
    aeropuerto_contacto: "Roxana Pérez",
    tarifa: 80
  }
]

export default async (ctx: BotContext, { state, gotoFlow, extensions, flowDynamic, endFlow }: BotMethods) => {
    if (state.get('finished')) return

    if (globalFlags.agentMessageReceived) {
        // console.log("⛔ Chat bloqueado porque ya respondió un agente")
        cancelReminders(ctx.from, state)
        await state.update({ finished: true })
        return
    }

    await state.update({ lastUserAt: Date.now() })
    cancelReminders(ctx.from, state)

    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state as any)
    const userPhone = ctx.from
    const userExists = USER_DATABASE.some(user => user.phone === userPhone)

    // console.log(userExists ? "conocido" : "desconocido")
    const prompt = CLASSIFIER_PROMPT(history, userExists)

    let text = ""
    try {
        text = await ai.createChat([{ role: "system", content: prompt }], "gpt-4.1-nano")
    } catch (err) {
        console.error("Error en IA:", err)
    }

    const label = text.trim().toUpperCase()
    
    logInfo("AI_RESPONSE", label)

    switch (label) {
        case "TALK":
            return gotoFlow(flowTalk)
        case "LEAD":
            return gotoFlow(flowLead)
        default:
            logWarn("AI_CLASSIFIER", `Etiqueta inesperada: ${label}`)
            scheduleReminders(ctx, state, flowDynamic, endFlow)
            await flowDynamic("🤖 Estoy revisando tu mensaje, en breve te respondo...")
    }
}
