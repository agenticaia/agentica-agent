import { globalFlags } from "~/core/globals"
import { config } from "../../config"
import { HubSpotClass } from "../hubspot"

const hubspot = new HubSpotClass({
    token: config.hubspotToken!,
    endpoint: config.hubspotEndpoint!,
})

const handlerMessage = async (dataIn: any, chatwoot: any) => {
    const inbox = await chatwoot.findOrCreateInbox({ name: `${config.inboxName}` })
    const contact = await chatwoot.findOrCreateContact({
        from: dataIn.phone,
        name: dataIn.name,
        inbox: inbox.id,
    })

    const { conversation, isNew } = await chatwoot.findOrCreateConversation({
        inbox_id: inbox.id,
        contact_id: contact.id,
        phone_number: dataIn.phone,
    })

    let ownerName = ""
    let hubspotOwnerId: string | undefined

    if (isNew) {
        const hubspotContact = await hubspot.searchContactByPhone(dataIn.phone)

        if (hubspotContact && hubspotContact.properties?.hubspot_owner_id) {
            hubspotOwnerId = hubspotContact.properties.hubspot_owner_id

            const owners = await hubspot.getOwners()
            const matchedOwner = owners.find((o: any) => o.id === hubspotOwnerId)

            if (matchedOwner) {
                ownerName = `${matchedOwner.firstName} ${matchedOwner.lastName}`

                const agents = await chatwoot.getAgents()
                const matchedAgent = agents.find((a: any) => a.email === matchedOwner.email)

                if (matchedAgent) {
                    await chatwoot.assignAgentToConversation(conversation.id, matchedAgent.id)
                    // console.log("🟢 Asignado agente:", matchedOwner.email)
                }
            }
        } else {
            const agent = await chatwoot.getNextAgent()
            const agentEmail = agent.email
    
            const owners = await hubspot.getOwners()
            const matchedOwner = owners.find((owner: any) => owner.email === agentEmail)
    
            ownerName = agent?.name
            hubspotOwnerId = matchedOwner?.id
    
            await chatwoot.assignAgentToConversation(conversation.id, agent.id)
            // console.log("🟢 Asignado agente:", matchedOwner.email)
        }

        globalFlags.hubspotOwnerId = hubspotOwnerId
    }

    await chatwoot.createMessage({
        msg: dataIn.message,
        mode: dataIn.mode,
        conversation_id: conversation.id,
        attachment: dataIn.attachment,
    })

    return { ownerName, hubspotOwnerId }
}

export { handlerMessage }
