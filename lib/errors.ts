export class UserError extends Error {}

const GATEWAY_BILLING_MESSAGE =
  'El servicio de IA (AI Gateway) requiere una tarjeta registrada en tu cuenta de Vercel para funcionar. Agregala desde el panel de Vercel y volvé a intentar.'

function isGatewayBillingError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const { statusCode, message } = error as { statusCode?: number; message?: unknown }
  return statusCode === 403 && typeof message === 'string' && message.includes('credit card')
}

export function toUserMessage(error: unknown, fallback: string) {
  if (error instanceof UserError) return error.message
  if (isGatewayBillingError(error)) return GATEWAY_BILLING_MESSAGE
  console.error('[action] unexpected error', error)
  return fallback
}
