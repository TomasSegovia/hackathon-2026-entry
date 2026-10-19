import { AppHeader } from '@/components/app-header'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="min-h-svh">
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
