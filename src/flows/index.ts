import { createFlow } from "@builderbot/bot"
import welcomeFlow from "./welcome.flow"
import { flowTalk } from "./talk.flow"
import { flowLead } from "./lead.flow"
import { flowQuote } from "./quote.flow"

export default createFlow([
    welcomeFlow,
    flowTalk,
    flowLead,
    flowQuote,
])