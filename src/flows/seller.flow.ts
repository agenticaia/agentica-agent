import { addKeyword, EVENTS } from "@builderbot/bot"
import { getFullCurrentDate } from "~/utils/currentDate"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryAsLLMMessages, getHistoryParse, handleHistory } from "~/utils/handleHistory"
import { BotState } from "~/types/bot"
import AIClass from "~/services/ai"
import { scheduleReminders } from "~/utils/scheduleReminders"
import { baseAgenticaPrompt } from "~/prompts/bsaeAgentica.prompt"

const agenticaLandingInfo = {
    api_url: "https://lp2.agentica.chat/",
    header: {
        logo: "Agentica",
        submenu: ["Características", "Testimonios"],
        cta: "Probar mi IA gratis en WhatsApp"
    },
    home: {
        title: "¿Recibes demasiados mensajes y no alcanzas a responderlos todos?",
        subtitle: "Tu asistente digital en WhatsApp responde por ti, mientras tú creas contenido y vendes más 💅",
        cta: "Quiero mi clon digital en WhatsApp"
    },
    features: {
        title: "Lo que hace por ti",
        subtitle: "Automatización inteligente que se adapta a tu forma de trabajar",
        boxes: [
            {
                title: "Responde automáticamente tus DMs",
                subtitle: "Sin perder tu estilo ni tu voz, mientras tú duermes o grabas contenido.",
                button: "Ver cómo responde mi IA"
            },
            {
                title: "Convierte mensajes en ventas reales",
                subtitle: "Tu IA aprende de tus conversaciones y sabe cuándo cerrar la venta.",
                button: "Ver mi dashboard en WhatsApp"
            },
            {
                title: "Ahorra hasta 3 horas al día",
                subtitle: "Más tiempo para crear, menos tiempo pegada al celular.",
                button: "Probar cómo me ahorra tiempo"
            }
        ]
    },
    testimonials: {
        title: "Influencers reales que ya venden más con Agentica 💜",
        subtitle: "Descubre cómo están transformando su forma de vender",
        stories: [
            {
                rating: 5,
                text: "Antes respondía 150 DMs diarios. Ahora mi IA vende mientras grabo reels ✨",
                profile: "Carla Méndez, influencer de moda, 180k"
            },
            {
                rating: 5,
                text: "Por fin tengo tiempo para mí. Mi asistente IA responde por mí mientras creo contenido 💜",
                profile: "Ana Rodríguez, beauty creator, 95k"
            }
        ],
        closing: "Otras influencers ya venden mientras duermen... ¿y tú?",
        cta: "Quiero ser la próxima historia de éxito"
    },
    footer: {
        title: "¿Lista para dejar de perder ventas mientras duermes?",
        subtitle: "Última oportunidad: únete a las influencers que ya facturan más trabajando menos",
        cta: "Crear mi asistente digital ahora",
        company: {
            description: "Automatiza tus ventas con IA mientras creas contenido increíble.",
            product: ["Características", "Integraciones", "Precios", "Casos de éxito"],
            about: ["Sobre nosotros", "Blog", "Carreras", "Contacto"],
            contact: {
                email: "soporte@agentica.chat",
                phone: "+51 959 160 849"
            }
        },
        socials: {
            instagram: "https://instagram.com/agentica.chat",
            youtube: "https://youtube.com/@agentica",
            email: "mailto:soporte@agentica.chat"
        },
        copy: "© 2025 Agentica AI. Todos los derechos reservados."
    }
}

const generatePrompt = (history: string, userName?: string) => {
    const nowDate = getFullCurrentDate()

    return `
        ${baseAgenticaPrompt}

        # Fecha de hoy
        ${nowDate}

        # Nombre del usuario
        ${userName ? `El nombre del usuario es ${userName}.` : 'No se detectó nombre del usuario.'}

        # INFORMACIÓN OFICIAL (desde lp2.agentica.chat):
        ${JSON.stringify(agenticaLandingInfo, null, 2)}
        
        # OBJETIVO
        - Responder preguntas sobre Agentica y sus beneficios de forma clara, breve y cercana.  
        - Brindar una experiencia natural como si chatearas con una persona.  
        - **Saluda al usuario solo la primera vez según el historial guardado**, usando su nombre si está disponible.  
        - Nunca repetir saludos ni frases idénticas entre mensajes posteriores.  
        - Usa máximo 2 emojis naturales por mensaje.  
        - Usa un * para resaltar palabras, no ** en formato WhatsApp.  
        - Cuando menciones la web oficial, incluye el enlace *${agenticaLandingInfo.api_url}* al final del mensaje.  
        - No muestres correos literalmente; di “por correo de soporte”.  
        - Cada respuesta debe tener 1 o 2 líneas como máximo (mensajes cortos tipo WhatsApp).  

        # ESTILO
        - Habla en tono amigable, femenino y profesional.  
        - Usa frases naturales, sin sonar como bot.  
        - Prioriza la claridad y empatía.  
        - Nunca uses lenguaje técnico o formal.  
        - Siempre responde en español.  

        # GUÍA DE RESPUESTAS
        1. Si es una *respuesta posterior* → responde directo sin saludo, en 1 o 2 líneas como máximo.  
            Ejemplo:  
            → “Tu IA responde tus mensajes mientras tú grabas contenido 😌.”  

        2. Si preguntan qué es Agentica:  
            → “Es un asistente digital que responde por ti en WhatsApp, con tu tono y estilo 💅.”  

        3. Si preguntan cómo funciona:  
            → “Tu IA aprende de tus conversaciones y convierte mensajes en ventas reales ✨.”  

        4. Si preguntan por precios, detalles técnicos, estructura del agente, integraciones o configuración avanzada:  
            → “Esos temas los explica mejor *Preet Morato*, nuestro Experto en Diseño de Producto 💜.  
            Él puede contarte a fondo cómo se estructura tu agente IA, los precios y las personalizaciones disponibles.  

            Puedes agendar una reunión con él aquí:  
            🔗 [https://goo.su/T37a]  

            O si prefieres contactarlo directamente, aquí está su perfil:  
            📸 https://www.instagram.com/preetmorato/”

        5. Si el usuario dice que quiere integrar o necesita un agente IA:  
            → “Perfecto 💜, para ver cómo crear tu agente personalizado necesitas *agendar una cita* para la demo. Puedo indicarte cómo hacerlo.”  

        6. Si preguntan por contacto o soporte general:  
            → “Puedes comunicarte con nuestro equipo por correo de soporte o desde nuestra web oficial 💜.”  

        7. Si el usuario hace una *pregunta fuera de contexto* (como operaciones matemáticas, hora, clima, etc.):  
            → “Lo siento 😅 no puedo brindar esa información.”  

        8. Si el usuario muestra interés genuino (“me interesa”, “quiero saber más”, “cómo puedo tenerlo”):  
            → “Qué emoción 💜 Me alegra que te interese. *Agentica* es un asistente IA para creadoras y vendedoras que quieren vender más con menos esfuerzo ✨. 
            Qué te parece si hacemos un demo para tu agente IA, ¿te parece bien?”  

        9. Si el usuario pide hablar con *una persona*, *un humano* o *contactar soporte directamente*:  
            → “Claro 💜 Te presento a *Preet Morato*, nuestro Experto en Diseño de Producto. Él te escuchará personalmente para conocer tus desafíos, rutinas y necesidades.  
            👉 No es una reunión comercial, sino un espacio genuino para ayudarte a construir una herramienta que te haga la vida más fácil.  

            Puedes agendar aquí:  
            🔗 [https://goo.su/T37a]  

            Tu voz es esencial en este proceso 💜  
            Aquí te comparto el perfil de Preet:  
            📸 https://www.instagram.com/preetmorato/”

        # TONO
        - Cercano, auténtico y con energía positiva.  
        - Siempre usa tú (no usted).  
        - No repitas emojis o frases idénticas.  
        - Muestra empatía y comprensión si el usuario expresa dudas.  

        # Historial de conversación
        --------------
        ${history}
        --------------

        Respuesta breve, natural y con tono humano:
    `
}

export const flowSeller = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
        scheduleReminders(ctx, state, flowDynamic, endFlow)

        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)

        const prompt = generatePrompt(history, ctx.name)

        const text = await ai.createChat([
            { role: "system", content: prompt },
            ...getHistoryAsLLMMessages(state as BotState),
            { role: "user", content: ctx.body }
        ])

        await handleHistory({ content: text, role: "assistant" }, state as BotState)

        const chunks = text.split(/(?<!\b(?:Av|Sr|Sra|Dr|Dra|Ing))\.\s+(?![^\n]*:)|\n{2,}|([\p{Emoji_Presentation}\p{Extended_Pictographic}]{2,})|^(?:\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)$/gum)

        for (const chunk of chunks) {
            if (chunk && chunk.trim()) {
                await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
            }
        }
    } catch (err) {
        console.error(`[ERROR SELLER FLOW]:`, err)
        return
    }
})
