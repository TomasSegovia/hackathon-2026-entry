import { NextResponse, type NextRequest } from 'next/server'
import { getBookCatalog } from '@/lib/fceia/books'
import { getUserId } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const subjectId = Number(request.nextUrl.searchParams.get('subjectId'))
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getBookCatalog(subjectId))
  } catch (error) {
    console.error('[fceia] books failed', error)
    return NextResponse.json({ error: 'No pude consultar la FCEIA.' }, { status: 502 })
  }
}
