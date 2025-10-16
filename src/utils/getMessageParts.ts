import fs from "fs"
import path from "path"
import { config } from "~/config"

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")
const ensureUploadsDir = () => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

export async function getMessageParts(payload: any): Promise<{ text: string; attachments: any[] }> {
    const type = payload.type

    if (type === "text") {
        return {
            text: payload.body || "",
            attachments: []
        }
    }

    if (type === "image") {
        try {
            ensureUploadsDir()

            // const buffer = await fetch(`https://graph.facebook.com/v18.0/${payload.media_id}`, {
            //   headers: { Authorization: `Bearer ${config.META_TOKEN}` }
            // }).then(r => r.buffer())

            const buffer = Buffer.from([])

            const fileName = `img_${payload.from}_${Date.now()}.jpg`
            const filePath = path.join(UPLOADS_DIR, fileName)

            fs.writeFileSync(filePath, buffer)

            return {
                text: payload.caption || "📷 Imagen",
                attachments: [
                    {
                        file_type: "image",
                        file_url: `${config.botURL}/uploads/${fileName}`,
                        file_name: fileName
                    }
                ]
            }
        } catch (e) {
            console.error("Error guardando imagen:", e)
            return { text: "📷 Imagen (no se pudo guardar)", attachments: [] }
        }
    }

    if (type === "video") {
        return { text: "🎥 Video recibido", attachments: [] }
    }

    if (type === "audio") {
        return { text: "🎵 Audio recibido", attachments: [] }
    }

    if (type === "document") {
        return { text: "📄 Documento recibido", attachments: [] }
    }

    return { text: "", attachments: [] }
}
