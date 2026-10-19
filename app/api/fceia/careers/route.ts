import { NextResponse } from 'next/server'
import { listCareers } from '@/lib/fceia/client'
import { getUserId } from '@/lib/session'

export async function GET() {
  try {
    await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const careers = await listCareers()
    return NextResponse.json(
      careers.map(({ id, name, level }) => ({ id, name, level })),
    )
  } catch (error) {
    console.error('[fceia] careers failed', error)
    return NextResponse.json({ error: 'No pude consultar la FCEIA.' }, { status: 502 })
  }
}
