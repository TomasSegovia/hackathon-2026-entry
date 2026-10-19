import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
import { getSession } from '@/lib/session'

export const metadata = { title: 'Crear cuenta - Cuaderno' }

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect('/materias')

  return (
    <AuthShell
      title="Creá tu cuaderno"
      description="Guardá tus apuntes y encontrá qué estudiar para cada ejercicio."
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
