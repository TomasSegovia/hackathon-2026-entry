import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
import { getSession } from '@/lib/session'

export const metadata = { title: 'Ingresar - Cuaderno' }

export default async function SignInPage() {
  const session = await getSession()
  if (session?.user) redirect('/materias')

  return (
    <AuthShell title="Ingresá a tu cuaderno" description="Retomá tus materias y ejercicios.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
