import { addDays, format, nextDay } from 'date-fns'
import type { Day } from "date-fns"
import { es } from 'date-fns/locale'

/**
 * Devuelve la fecha completa actual en formato:
 * "17/10/2025 17:30 Viernes"
 */
const getFullCurrentDate = (): string => {
    const now = new Date()
    const datePart = format(now, "dd/MM/yyyy HH:mm", { locale: es })
    const weekday = format(now, "EEEE", { locale: es })
    const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)
    return `${datePart} ${capitalized}`
}

/**
 * Convierte expresiones relativas ("mañana", "lunes", etc.)
 * en una fecha absoluta basada en la fecha actual.
 */
const parseRelativeDate = (input: string, currentDate = new Date()): string | null => {
    const text = input.toLowerCase().trim()

    if (text.includes("hoy")) return format(currentDate, "dd/MM/yyyy", { locale: es })
    if (text.includes("mañana")) return format(addDays(currentDate, 1), "dd/MM/yyyy", { locale: es })
    if (text.includes("pasado mañana")) return format(addDays(currentDate, 2), "dd/MM/yyyy", { locale: es })

    // Días de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)
    const daysMap: Record<string, Day> = {
        domingo: 0 as Day,
        lunes: 1 as Day,
        martes: 2 as Day,
        miércoles: 3 as Day,
        miercoles: 3 as Day,
        jueves: 4 as Day,
        viernes: 5 as Day,
        sábado: 6 as Day,
        sabado: 6 as Day,
    }

    for (const [dayName, dayIndex] of Object.entries(daysMap)) {
        if (text.includes(dayName)) {
            const targetDate = nextDay(currentDate, dayIndex)
            return format(targetDate, "dd/MM/yyyy", { locale: es })
        }
    }

    return null
}

// console.log(parseRelativeDate("quiero para el lunes", currentDate)) // "20/10/2025"
// console.log(parseRelativeDate("quiero para pasado mañana", currentDate)) // "19/10/2025"

export { getFullCurrentDate, parseRelativeDate }