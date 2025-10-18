import { createFlow } from "@builderbot/bot"
import welcomeFlow from "./welcome.flow"
import { flowTalk } from "./talk.flow"
import { flowLead } from "./lead.flow"
import { flowSeller } from "./seller.flow"

export default createFlow([
    welcomeFlow,
    flowTalk,
    flowLead,
    flowSeller
])