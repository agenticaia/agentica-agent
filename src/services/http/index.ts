import { config } from "~/config"
import { globalFlags } from "~/core/globals"

const sentMessages = new Set<string>()

class ServerHttp {
    private provider: any
    private bot: any

    constructor (provider = undefined, bot = undefined) {
        if (!provider || !bot) throw new Error("DEBES_DE_PASAR_BOT")
        this.provider = provider
        this.bot = bot
        this.bot.dynamicBlackList = {
            store: new Set(),
            add(phone: string) { this.store.add(phone) },
            remove(phone: string) { this.store.delete(phone) },
            checkIf(phone: string) { return this.store.has(phone) }
        }
        provider.server.post("/chatwoot", this.chatwootCtrl)
    }

    chatwootCtrl = async (req: any, res: any) => {
        const body = req.body

        const attachments = body?.attachments
        try {
            const mapperAttributes = body?.changed_attributes
                ?.map((a) => Object.keys(a))
                .flat(2)

            if (
                body?.event === "conversation_updated" &&
                mapperAttributes.includes("assignee_id")
            ) {
                const phone = body?.meta?.sender?.phone_number.replace("+", "")
                const idAssigned = body?.changed_attributes[0]?.assignee_id?.current_value ?? null

                if (idAssigned) {
                    this.bot.dynamicBlackList.add(phone)
                    // console.log("Teléfono agregado a la blacklist:", phone)
                } else if (this.bot.dynamicBlackList.checkIf(phone) && !idAssigned) {
                    this.bot.dynamicBlackList.remove(phone)
                    // console.log("Teléfono removido de la blacklist:", phone)
                }

                res.statusCode = 200
                return res.end("ok")
            }

            if (
                body?.content_type === "input_csat" &&
                body?.event === "message_created" &&
                body?.conversation?.channel.includes("Channel::Api") &&
                body?.private == false &&
                body?.content?.includes("Por favor califica esta conversación") &&
                body?.conversation?.status === "resolved"
            ) {
                const phone = body.conversation?.meta?.sender?.phone_number.replace("+", "")
                const content = body?.content ?? ""

                const urlsToReplace = [
                    { oldUrl: "http://0.0.0.0", newUrl: config.chatwootEndpoint },
                    { oldUrl: "http://127.0.0.1", newUrl: config.chatwootEndpoint },
                ]

                let updatedContent = content

                urlsToReplace.forEach((urlPair) => {
                    updatedContent = updatedContent.replace(
                        new RegExp(urlPair.oldUrl, "g"),
                        urlPair.newUrl
                    )
                })

                await this.provider.sendMessage(`${phone}`, updatedContent, {})

                if (this.bot.dynamicBlackList.checkIf(phone)) {
                    this.bot.dynamicBlackList.remove(phone)
                    const response = await fetch(`${config.botURL}/v1/flowGracias`, {
                        method: "POST",
                        body: JSON.stringify({ number: phone, name: "Cliente" }),
                        headers: { "Content-Type": "application/json" },
                    })
                    res.statusCode = 200
                    return res.end("ok")
                } else {
                    const response = await fetch(`${config.botURL}/v1/flowGracias`, {
                        method: "POST",
                        body: JSON.stringify({ number: phone, name: "Cliente" }),
                        headers: { "Content-Type": "application/json" },
                    })
                }

                res.statusCode = 200
                return res.end("ok")
            }

            if (
                body?.event === "conversation_updated" &&
                body?.status === "resolved"
            ) {
                console.log(body.meta.sender)
                const phone = body?.meta?.sender?.phone_number.replace("+", "")

                if (this.bot.dynamicBlackList.checkIf(phone)) {
                    this.bot.dynamicBlackList.remove(phone)

                    const response = await fetch(`${config.botURL}/v1/flowGracias`, {
                        method: "POST",
                        body: JSON.stringify({ number: phone, name: "Cliente" }),
                        headers: { "Content-Type": "application/json" },
                    })

                    res.statusCode = 200
                    return res.end("ok")
                } else {
                    const response = await fetch(`${config.botURL}/v1/flowGracias`, {
                        method: "POST",
                        body: JSON.stringify({ number: phone, name: "Cliente" }),
                        headers: { "Content-Type": "application/json" },
                    })
                }
         
                res.statusCode = 200
                return res.end("ok")
            }

            if (
                body?.event === "message_created" &&
                body?.message_type === "outgoing" &&
                body?.conversation?.channel.includes("Channel::Api") &&
                body?.private === false
            ) {
                const phone = body?.conversation?.meta?.sender?.phone_number?.replace("+", "")
                const content = body?.content?.trim()
                const attachments = body?.attachments ?? []
                const messageId = body.id?.toString()
                const sourceId = body.source_id ?? ""
                
                // Evitar reenvío duplicado
                if (
                    !messageId ||
                    sentMessages.has(messageId) ||
                    sourceId.startsWith("bot-")
                ) {
                    res.statusCode = 200
                    return res.end("ok")
                }

                sentMessages.add(messageId)
                globalFlags.agentMessageReceived = true

                // console.log(attachments)

                try {
                    const jid = `${phone}@s.whatsapp.net`
                    if (attachments && attachments.length > 0) {
                        for (const file of attachments) {
                            if (file.file_type === "image") {
                                await this.provider.vendor.sendMessage(jid, { 
                                    image: { url: file.data_url }, 
                                    mimetype: "image/jpeg",
                                    caption: content 
                                })
                            } else if (file.file_type === "video") {
                                await this.provider.vendor.sendMessage(jid, {
                                    video: { url: file.data_url },
                                    mimetype: "video/mp4",
                                    caption: content
                                })
                            } else if (file.file_type === "audio") {
                                await this.provider.vendor.sendMessage(jid, {
                                    audio: { url: file.data_url },
                                    mimetype: "audio/mpeg",
                                    ptt: false
                                })
                            } else {
                                const fileName = file.data_url.split("/").pop()
                                await this.provider.vendor.sendMessage(jid, {
                                    document: { url: file.data_url },
                                    mimetype: file.mimetype ?? "application/pdf",
                                    fileName,
                                    caption: content
                                })
                            }
                        }
                    } else if (content) {
                        await this.provider.sendMessage(phone, content, {})
                    }
                } catch (err) {
                    console.error("Error enviando mensaje:", err)
                }

                // await this.provider.sendMessage(`${phone}`, content, {})

                res.statusCode = 200
                return res.end("ok")
            }

            res.statusCode = 200
            return res.end("ok")
        } catch (error) {
            console.error(error)
            res.statusCode = 405
            res.end("Error")
            return
        }
    }
}

export default ServerHttp
