import { createBot, createProvider, MemoryDB } from '@builderbot/bot'
import flows from './flows'
import Queue from "queue-promise"
import { config } from './config'
import AIClass from './services/ai'
import ServerHttp from './services/http'
import path from 'path'
import fs from 'fs'
import { getMessageParts } from './utils/getMessageParts'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { handlerMessage } from './services/chatwoot'
import { ChatwootClass } from './services/chatwoot/chatwoot.class'
import { HubSpotClass } from './services/hubspot'
 
const chatwoot = new ChatwootClass({
    account: config.chatwootAccountID,
    token: config.chatwootToken,
    endpoint: config.chatwootEndpoint,
})

const hubspot = new HubSpotClass({
    token: config.hubspotToken!,
    endpoint: config.hubspotEndpoint!,
})

const adapterProvider = createProvider(Provider, {
    jwtToken: config.jwtToken,
    numberId: config.numberId,
    verifyToken: config.verifyToken,
    version: config.version
})

const queue = new Queue({ concurrent: 1, interval: 500 })
const ai = new AIClass(config.ApiKey, config.Model)
const loggedTypes = new Set<string>()

const main = async () => {
    const bot = await createBot(
        {
            flow: flows,
            provider: adapterProvider,
            database: new MemoryDB(),
        },
        {
            extensions: { ai },
            queue: {
                timeout: 20000,
                concurrencyLimit: 30,
            }
        }
    )

    const { handleCtx, httpServer } = bot

    new ServerHttp(adapterProvider, bot)

    adapterProvider.server.get(
        "/v1/health",
        (
            _,
            res: {
                writeHead: (arg0: number, arg1: { "Content-Type": string }) => void
                end: (arg0: string) => void
            }
        ) => {
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ status: "ok" }))
        }
    )

    adapterProvider.server.post(
        "/v1/blackList",
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === "remove") {
                bot.blacklist.remove(number)
                await bot.dispatch("GRACIAS_FLOW", { from: number, name: "Cliente" })
                return res.end("trigger")
            }
            if (intent === "add") {
                bot.blacklist.add(number)
            }
            res.writeHead(200, { "Content-Type": "application/json" })
            return res.end(JSON.stringify({ status: "ok", number, intent }))
        })
    )

    adapterProvider.server.get(
        "/uploads/:file",
        (
            req: any,
            res: any
        ) => {
            const file = req.params.file
            const filePath = path.join(process.cwd(), "public", "uploads", file)

            if (!fs.existsSync(filePath)) {
                res.writeHead(404)
                return res.end("Not Found")
            }

            const ext = (file.split(".").pop() || "").toLowerCase()
            const mime =
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                ext === "png" ? "image/png" :
                ext === "webp" ? "image/webp" :
                ext === "mp4" ? "video/mp4" :
                ext === "mp3" ? "audio/mpeg" :
                ext === "ogg" ? "audio/ogg" :
                ext === "pdf" ? "application/pdf" :
                "application/octet-stream"

            res.writeHead(200, { "Content-Type": mime })
            fs.createReadStream(filePath).pipe(res)
        }
    )

    adapterProvider.on("message", (payload) => {
        queue.enqueue(async () => {
            try {
                const messageType = payload.type || "unknown"

                if (!loggedTypes.has(messageType)) {
                    // console.log("📩 Tipo detectado:", messageType, "| Usuario:", payload.from)
                    // console.log("📩 Payload ejemplo:", JSON.stringify(payload, null, 2))
                    loggedTypes.add(messageType)
                }
                
                const { text, attachments } = await getMessageParts(payload)

                if (!text && attachments.length === 0) {
                    console.log(`⛔ No se pudo extraer texto del mensaje | Usuario: ${payload.from}`)
                    return
                }

                // console.log(attachments)

                const agentData = await handlerMessage(
                    {
                        phone: payload.from,
                        name: payload.pushName,
                        message: text,
                        mode: "incoming",
                        attachment: attachments,
                    },
                    chatwoot
                )

                await hubspot.create({
                    name: payload.pushName,
                    phone: payload.from,
                    hubspot_owner_id: agentData?.hubspotOwnerId ?? ""
                })
            } catch (error) {
                console.log("ERROR", error)
            }
        })
    })

    bot.on("send_message", (payload) => {
        queue.enqueue(async () => {
            const attachment = []

            await handlerMessage(
                {
                    phone: payload.from,
                    name: payload.from,
                    message: payload.answer,
                    mode: "outgoing",
                    attachment: attachment,
                },
                chatwoot
            )
        })
    })
    
    httpServer(+config.PORT)
}

main()
