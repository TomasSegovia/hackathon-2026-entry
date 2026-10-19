import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, FileSearch, Globe, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/session'

const steps = [
  {
    icon: Upload,
    title: 'Subí tu consigna',
    text: 'Un ejercicio, una práctica o un examen completo. Pegá el texto o subí un PDF.',
  },
  {
    icon: FileSearch,
    title: 'Buscamos en tu material',
    text: 'Cruzamos cada punto con tus apuntes, exámenes anteriores y bibliografía, y te mostramos el fragmento exacto.',
  },
  {
    icon: Globe,
    title: 'Internet, solo si vos querés',
    text: 'Si no hay nada en tu material, te preguntamos antes de buscar afuera.',
  },
]

export default async function HomePage() {
  const session = await getSession()
  if (session?.user) redirect('/materias')

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <span className="flex items-center gap-2 font-serif text-lg font-semibold">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          Cuaderno
        </span>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/sign-in" />}>
            Ingresar
          </Button>
          <Button nativeButton={false} render={<Link href="/sign-up" />}>
            Crear cuenta
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 md:py-24">
          <h1 className="max-w-2xl text-4xl leading-tight font-semibold text-balance md:text-6xl">
            Antes de resolver, encontrá{' '}
            <span className="bg-accent px-1">qué tenés que estudiar</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Subí un ejercicio o un examen y Cuaderno te indica en qué apunte, parcial anterior o
            libro está la teoría de cada punto. No te da la resolución: te lleva a la fuente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
              Empezar gratis
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/sign-in" />}
            >
              Ya tengo cuenta
            </Button>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="border-t py-12">
          <h2 id="como-funciona" className="text-2xl font-semibold">
            Cómo funciona
          </h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}
