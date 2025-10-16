export function logInfo(label: string, message: any) {
  console.log(`ℹ️  [${label}]`, message)
}

export function logError(label: string, error: any) {
  console.error(`[${label}]`, error)
}

export function logWarn(label: string, message: any) {
  console.warn(`⚠️  [${label}]`, message)
}
