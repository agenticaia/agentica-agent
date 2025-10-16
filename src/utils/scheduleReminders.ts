const timeouts = {
    "3m": 3 * 60 * 1000,
    "15m": 15 * 60 * 1000,
} as const

const reminderRegistry = new Map<string, NodeJS.Timeout[]>()

export function cancelReminders(key: string, state: any) {
    const prev = reminderRegistry.get(key)
    if (prev) prev.forEach(clearTimeout)
    reminderRegistry.delete(key)
    state.update?.({ remindersActive: false })
}

export function scheduleReminders(
    ctx: any, 
    state: any, 
    flowDynamic: (msg: any) => Promise<any>,
    endFlow: (msg: string) => void
) {
    const key = ctx.from as string

    cancelReminders(key, state)

    state.update?.({ remindersActive: true })

    const timers: NodeJS.Timeout[] = []

    const userInactiveSince = (ms: number) => {
        const lastUserAt = state.get ? state.get('lastUserAt') : state.lastUserAt
        if (typeof lastUserAt !== 'number') return true
        return (Date.now() - lastUserAt) >= (ms - 250)
    }

    timers.push(setTimeout(async () => {
        try {
            if (!userInactiveSince(timeouts["3m"])) return
            await flowDynamic("👋 ¿Sigues por aquí?")
        } catch (e) {
            console.error("[reminder 3m] error:", e)
        }
    }, timeouts["3m"]))

    timers.push(setTimeout(async () => {
        try {
            const finished = state.get ? state.get('finished') : state.finished
            if (finished) return
            if (!userInactiveSince(timeouts["15m"])) return

            cancelReminders(key, state)
            await state.update?.({ finished: true, remindersActive: false })
            await endFlow("💬 Gracias por escribirnos 🙏. Una 👩‍💼 *asesora* te atenderá pronto. ⏰ Horario: *8:00 AM - 6:30 PM*")
        } catch (e) {
            console.error("[reminder 15m] error:", e)
        }
    }, timeouts["15m"]))

    reminderRegistry.set(key, timers)
}
