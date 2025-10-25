export const normalizeData = (input: Record<string, any>) => Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ?? "-"])
)

export const generateServiceId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000) // 4 dígitos
    return `SERVEDW-${randomNum}`
}
