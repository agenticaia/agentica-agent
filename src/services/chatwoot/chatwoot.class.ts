class ChatwootClass {
    config: { account?: string; token?: string; endpoint?: string }

    constructor(
        _config: { account?: string; token?: string; endpoint?: string } = {}
    ) {
        if (!_config?.account) throw new Error("ACCOUNT_ERROR")
        if (!_config?.token) throw new Error("TOKEN_ERROR")
        if (!_config?.endpoint) throw new Error("ENDPOINT_ERROR")

        this.config = _config
    }

    private agentIndex = 0

    private get headers() {
        return {
            "Content-Type": "application/json",
            api_access_token: this.config.token!,
        }
    }

    private async request(method: string, path: string, body?: any) {
        const response = await fetch(`${this.config.endpoint}/api/v1${path}`, {
            method,
            headers: this.headers,
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Chatwoot API Error: ${text}`)
        }

        return response.json()
    }

    buildBaseUrl = (route: string) => {
        return `${this.config.endpoint}/api/v1/accounts/${this.config.account}${route}`
    }

    formatNumber = (number: any) => {
        if (!number.startsWith("+")) {
            return `+${number}`
        }
        return number
    }

    async getAgents() {
        const url = this.buildBaseUrl("/agents")

        const response = await fetch(url, {
            method: "GET",
            headers: this.headers
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Chatwoot API Error: ${text}`)
        }

        return await response.json()
    }

    async getNextAgent() {
        const response = await this.getAgents()
        const agents = response.filter((agent: any) => agent.role === "administrator")

        if (!agents || agents.length === 0) throw new Error("No hay agentes disponibles en Chatwoot")

        // const randomIndex = Math.floor(Math.random() * agents.length)
        const agent = agents[this.agentIndex % agents.length]
        this.agentIndex++
        return agent
        // return agents[randomIndex]
    }

    async assignAgentToConversation(conversationId: number, agentId: number) {
        const url = this.buildBaseUrl(`/conversations/${conversationId}/assignments`)

        const response = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ assignee_id: agentId })
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`No se pudo asignar el agente: ${text}`)
        }

        return await response.json()
    }

    async findOrCreateInbox({ name }: { name: string }) {
        const response = await this.request("GET", `/accounts/${this.config.account}/inboxes`)
        const inbox = response.payload.find((inbox: any) => inbox.name === name)

        if (inbox) return inbox

        return await this.request("POST", `/accounts/${this.config.account}/inboxes`, {
            name,
            channel: {
                type: "Channel::Api",
            },
        })
    }

    async findContact(from: string) {
        try {
            const url = this.buildBaseUrl(`/contacts/search?q=${from}`)

            const response = await fetch(url, {
                method: "GET",
                headers: this.headers,
            })

            const data = await response.json()

            if (!data?.payload || data.payload.length === 0) return null

            return data.payload[0]
        } catch (error) {
            console.error("[Error searchByNumber]", error)
            return []
        }
    }

    async createContact(
        dataIn: any = { from: "", name: "", inbox: "" }
    ) {
        try {
            dataIn.from = this.formatNumber(dataIn.from)

            const data = {
                inbox_id: dataIn.inbox,
                name: dataIn.name,
                phone_number: dataIn.from,
            }

            const url = this.buildBaseUrl("/contacts")

            const dataFetch = await fetch(url, {
                headers: this.headers,
                method: "POST",
                body: JSON.stringify(data),
            })
            
            const response = (await dataFetch.json()) as { payload: any }
            return response.payload.contact
        } catch (error) {
            console.error("[Error createContact]", error)
            return
        }
    }

    async findOrCreateContact(
        dataIn: any = { from: "", name: "", inbox: "" }
    ) {
        try {
            dataIn.from = this.formatNumber(dataIn.from)
            const getContact = await this.findContact(dataIn.from)
            if (!getContact) return await this.createContact(dataIn)
            return getContact
        } catch (error) {
            console.error("[Error findOrCreateContact]", error)
            return
        }
    }

    async findConversation(dataIn: {
        phone_number: string
        inbox_id: number
    }) {
        try {
            const payload = {
                payload: [
                    {
                        attribute_key: "phone_number",
                        filter_operator: "equal_to",
                        values: [dataIn.phone_number],
                        query_operator: "AND",
                    },
                    {
                        attribute_key: "inbox_id",
                        filter_operator: "equal_to",
                        values: [dataIn.inbox_id],
                        // query_operator: null,
                    }
                ]
            }

            const url = this.buildBaseUrl("/conversations/filter")
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`HTTP error! status: ${response.status} - ${text}`)
            }

            const data = (await response.json()) as { payload: any[] }
            return data.payload
        } catch (error) {
            console.error("[Error findConversation]", error.message)
            return null
        }
    }

    async findOrCreateConversation(dataIn: {
        inbox_id: number
        contact_id: string
        phone_number: string
    }): Promise<{ conversation: any; isNew: boolean }> {
        try {
            const existing = await this.findConversation({
                phone_number: dataIn.phone_number,
                inbox_id: dataIn.inbox_id,
            })

            if (existing && existing.length > 0) {
                return { conversation: existing[0], isNew: false }
            }

            const payload = {
                source_id: dataIn.phone_number,
                inbox_id: dataIn.inbox_id,
                contact_id: dataIn.contact_id,
                custom_attributes: {
                    phone_number: dataIn.phone_number
                }
            }

            const url = this.buildBaseUrl("/conversations")
            
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            })
            
            const conversation = await response.json()
            return { conversation, isNew: true }
        } catch (error) {
            console.error("[Error findOrCreateConversation]", error)
            return { conversation: null, isNew: false }
        }
    }

    async createMessage(dataIn: {
        msg: string
        mode: string
        conversation_id: string
        attachment: any[]
    }) {
        try {
            const hasAttachment = dataIn.attachment && dataIn.attachment.length > 0

            const payload: any = {
                content: dataIn.msg,
                message_type: dataIn.mode === "incoming" ? "incoming" : "outgoing",
                content_type: "text",
                // content_type: (dataIn.attachment && dataIn.attachment.length > 0) ? "attachment" : "text",
                source_id: `bot-${Date.now()}`
            }
            
            if (hasAttachment) {
                const file = dataIn.attachment![0]

                payload.attachment = {
                    media_type: file.file_type,
                    media_url: file.file_url,
                    // file_name: file.file_name
                }
            }

            // console.log("📤 Enviando a Chatwoot:", JSON.stringify(payload, null, 2))

            const url = this.buildBaseUrl(`/conversations/${dataIn.conversation_id}/messages`)
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            })
            
            // console.log(response)
            
            return await response.json()
        } catch (error) {
            console.error("[Error createMessage]", error)
            return null
        }
    }

    async addTagToConversation(conversationId: string | number, tag: string) {
        try {
            const url = this.buildBaseUrl(`/conversations/${conversationId}/labels`)
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({ labels: [tag] }),
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Failed to add tag: ${text}`)
            }

            return await response.json()
        } catch (error) {
            console.error("[Error addTagToConversation]", error)
            return null
        }
    }

    async sendMessage(conversationId: string | number, message: string) {
        try {
            const payload = {
                content: message,
                message_type: "outgoing",
                content_type: "text",
            }

            const url = this.buildBaseUrl(`/conversations/${conversationId}/messages`)
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Error al enviar mensaje: ${text}`)
            }

            return await response.json()
        } catch (error) {
            console.error("[Error sendMessage]", error)
            return null
        }
    }
}

export { ChatwootClass }