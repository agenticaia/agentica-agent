import { config } from "../../config"

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

    if (isNew) {
        const agent = await chatwoot.getNextAgent()

        ownerName = agent?.name

        await chatwoot.assignAgentToConversation(conversation.id, agent.id)
        // console.log("🟢 Asignado agente:", agent.email)
    }

    await chatwoot.createMessage({
        msg: dataIn.message,
        mode: dataIn.mode,
        conversation_id: conversation.id,
        attachment: dataIn.attachment,
    })

    return { ownerName }
}

export { handlerMessage }
