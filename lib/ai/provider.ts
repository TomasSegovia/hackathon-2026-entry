import 'server-only'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

export const structureModel = openrouter.chat('anthropic/claude-sonnet-4.6')
export const exerciseModel = openrouter.chat('anthropic/claude-haiku-4.5')
export const embeddingModel = openrouter.textEmbeddingModel('openai/text-embedding-3-small')
