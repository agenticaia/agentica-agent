class HubSpotClass {
    private token: string
    private endpoint: string

    constructor(config: { token: string; endpoint: string }) {
        if (!config.token) throw new Error("HUBSPOT_TOKEN_ERROR")
        if (!config.endpoint) throw new Error("HUBSPOT_ENDPOINT_ERROR")

        this.token = config.token
        this.endpoint = config.endpoint
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
        }
    }

    request = async (method: string, path: string, body?: any) => {
        const response = await fetch(`${this.endpoint}${path}`, {
            method,
            headers: this.headers,
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`HubSpot API Error: ${text}`)
        }

        return response.json()
    }

    getOwners = async () => {
        const result = await this.request("GET", "/crm/v3/owners")
        return result.results || []
    }

    searchContactByPhone = async (phone: string) => {
        const result = await this.request("POST", "/crm/v3/objects/contacts/search", {
            filterGroups: [
                {
                    filters: [
                        { propertyName: "phone", operator: "EQ", value: `+${phone}` }
                    ],
                },
            ],
            properties: ["phone", "hubspot_owner_id", "firstname"],
            limit: 1,
        })

        return result.results?.[0] ?? null
    }

    searchContactByEmail = async (email: string) => {
        const result = await this.request("POST", "/crm/v3/objects/contacts/search", {
            filterGroups: [
                {
                    filters: [
                        { propertyName: "email", operator: "EQ", value: email }
                    ],
                },
            ],
            properties: ["email", "firstname", "phone", "hubspot_owner_id"],
            limit: 1,
        })

        return result.results?.[0] ?? null
    }

    create = async ({ name, phone, hubspot_owner_id }: { name: string; phone: string, hubspot_owner_id: string }) => {
        const exists = await this.searchContactByPhone(phone)
        if (exists) {
            // console.log(`ℹ️  Usuario ${phone} ya existe en Hubspot, no se creará`)
            return
        }

        const properties: any = { 
            firstname: name,
            phone: `+${phone}`,
            hubspot_owner_id
        }
        
        return this.request("POST", "/crm/v3/objects/contacts", { properties })
    }

    update = async ({ phone, updates }: { phone: string, updates: Record<string, any> }) => {
        const contact = await this.searchContactByPhone(phone)

        // if (!contact) {
        //     console.warn(`⚠️ No se encontró contacto con número: ${phone}, creando nuevo...`)
        //     await this.create({ 
        //         name: updates.firstname || "Sin nombre", 
        //         phone, 
        //         hubspot_owner_id: updates.hubspot_owner_id || "" 
        //     })
        //     contact = await this.searchContactByPhone(phone)
        // }

        if (!contact) throw new Error(`No se pudo crear ni encontrar contacto con número: ${phone}`)
        return this.request("PATCH", `/crm/v3/objects/contacts/${contact.id}`, { properties: updates })
    }
}

export { HubSpotClass }
