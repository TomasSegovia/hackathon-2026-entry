import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { SignOutButton } from '@/components/sign-out-button'

export function AppHeader({ userName }: { userName: string }) {
  return (
    <header className="border-b bg-card/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/materias" className="flex items-center gap-2 font-serif text-lg font-semibold">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          Cuaderno
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
