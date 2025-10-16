import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const getFullCurrentDate = (): string => {
    const currentD = new Date()
    const formatDate = format(currentD, 'dd/MM/yyyy HH:mm', { locale: es })
    const day = format(currentD, 'EEEE', { locale: es }) // Obtener el día de la semana

    return [
        formatDate,
        day.charAt(0).toUpperCase() + day.slice(1),
    ].join(' ')
}

export { getFullCurrentDate }