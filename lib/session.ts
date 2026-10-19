import 'server-only'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireUser() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return session.user
}

export async function getUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error('No autorizado')
  return session.user.id
}
