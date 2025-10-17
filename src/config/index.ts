import "dotenv/config"

export const config = {
    PORT: process.env.PORT ?? 3008,
    // Meta
    jwtToken: process.env.JWT_TOKEN ?? "",
    numberId: process.env.NUMBER_ID ?? "",
    verifyToken: process.env.VERIFY_TOKEN ?? "",
    version: "v24.0",
    // AT
    Model: process.env.OPENAI_MODEL,
    ApiKey: process.env.OPENAI_API_KEY,
    // HubSpot
    hubspotToken: process.env.HUBSPOT_TOKEN,
    hubspotEndpoint: process.env.HUBSPOT_ENDPOINT,
    // Chatwoot
    chatwootAccountID: process.env.ACCOUNT_ID,
    chatwootToken: process.env.CHATWOOT_TOKEN,
    chatwootEndpoint: process.env.CHATWOOT_ENDPOINT,
    botURL: process.env.BOT_URL,
    inboxName: process.env.INBOX_NAME,
}
