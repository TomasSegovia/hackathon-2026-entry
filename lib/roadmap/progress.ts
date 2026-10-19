import type { ProgressStatus } from '@/lib/types'

export function deriveTopicStatus(subtopicStatuses: ProgressStatus[]): ProgressStatus {
  if (subtopicStatuses.length === 0) return 'pending'
  if (subtopicStatuses.every((status) => status === 'done')) return 'done'
  if (subtopicStatuses.every((status) => status === 'pending')) return 'pending'
  return 'learning'
}
