import { importPresetBatch } from '@/app/actions/fceia'

const BATCH_ATTEMPTS = 3

export class ActionError extends Error {}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retries transient failures (timeouts, dropped connections) without restarting the whole import. */
export async function runBatch(input: Parameters<typeof importPresetBatch>[0]) {
  let failure = new Error('Se cortó la conexión con el servidor.')
  for (let attempt = 0; attempt < BATCH_ATTEMPTS; attempt++) {
    try {
      const response = await importPresetBatch(input)
      if (response.ok) return response.result
      throw new ActionError(response.error)
    } catch (error) {
      if (error instanceof ActionError) throw error
      failure = error instanceof Error ? error : failure
      await wait(1500 * (attempt + 1))
    }
  }
  throw failure
}
