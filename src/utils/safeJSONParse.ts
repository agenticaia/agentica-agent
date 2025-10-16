export const safeJSONParse = async (
  retryFn: () => Promise<string>,
  delayMs = 1000
) => {
  let parsed: any = null
  let attempt = 0

  const parseAttempt = async (input: string) => {
    try {
      return JSON.parse(input)
    } catch {
      let fixed = input.trim().replace(/```json|```/g, "")
      const openBraces = (fixed.match(/{/g) || []).length
      const closeBraces = (fixed.match(/}/g) || []).length
      if (openBraces > closeBraces) fixed += "}".repeat(openBraces - closeBraces)

      try {
        return JSON.parse(fixed)
      } catch {
        return null
      }
    }
  }

  while (!parsed) {
    attempt++
    if (attempt > 1) {
      console.log(`♻️  Reintentando JSON (intento ${attempt})...`)
      await new Promise(res => setTimeout(res, delayMs))
    }

    parsed = await parseAttempt(await retryFn())
  }

  // console.log(`✅ JSON válido obtenido después de ${attempt} intento(s).`)
  return parsed
}
