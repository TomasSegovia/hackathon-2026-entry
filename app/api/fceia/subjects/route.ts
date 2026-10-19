import { NextResponse, type NextRequest } from 'next/server'
import { listSubjects } from '@/lib/fceia/client'
import { getUserId } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const careerId = Number(request.nextUrl.searchParams.get('careerId'))
  if (!Number.isInteger(careerId) || careerId <= 0) {
    return NextResponse.json({ error: 'Carrera inválida' }, { status: 400 })
  }

  try {
    const subjects = await listSubjects(careerId)
    return NextResponse.json(
      subjects.map(({ id, name, year, term, kind }) => ({ id, name, year, term, kind })),
    )
  } catch (error) {
    console.error('[fceia] subjects failed', error)
    return NextResponse.json({ error: 'No pude consultar la FCEIA.' }, { status: 502 })
  }
}
