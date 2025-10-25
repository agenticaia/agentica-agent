import { BotContext, BotMethods } from "@builderbot/bot/dist/types"
import { getHistoryParse } from "../utils/handleHistory"
import { CLASSIFIER_PROMPT } from "~/prompts/classifier.prompt"
import AIClass from "~/services/ai"
import { logInfo, logWarn } from "~/utils/logger"
import { cancelReminders, scheduleReminders } from "~/utils/scheduleReminders"
import { globalFlags } from "~/core/globals"
import { flowTalk } from "~/flows/talk.flow"
import { flowLead } from "~/flows/lead.flow"
import { flowSeller } from "~/flows/seller.flow"

const USER_DATABASE = [
  {
    phone: "519120038190",
    full_name: "Antony Espinoza",
    date: "17/10/2025",
    time: "14:00",
    email: "elmer.antony12@gmail.com",
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
        text = await ai.createChat([{ role: "system", content: prompt }])
    } catch (err) {
        console.error("Error en IA:", err)
    }

    const label = text.trim().toUpperCase()
    
    logInfo("AI_RESPONSE", label)

    switch (label) {
        // case "CHARLA":
            // return gotoFlow(flowTalk)
        case "AGENDAR":
            return gotoFlow(flowLead)
        case "HABLAR":
            return gotoFlow(flowSeller)
        default:
            logWarn("AI_CLASSIFIER", `Etiqueta inesperada: ${label}`)
            scheduleReminders(ctx, state, flowDynamic, endFlow)
            await flowDynamic("🤖 Estoy revisando tu mensaje, en breve te respondo...")
    }
}
