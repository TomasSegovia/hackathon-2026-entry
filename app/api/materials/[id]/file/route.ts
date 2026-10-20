import { and, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { materials } from '@/lib/db/schema'
import { fetchOriginalFile, getOriginalFileInfo } from '@/lib/fceia/client'
import { getUserId } from '@/lib/session'

export const maxDuration = 60

const KEY_PATTERN = /^fceia:(material|exam):(\d+)$/

function withExtension(filename: string) {
  return /\.[a-z0-9]{2,4}$/i.test(filename) ? filename : `${filename}.pdf`
}

function contentDisposition(name: string, inline: boolean) {
  const ascii = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\- ]+/g, '_')
  const type = inline ? 'inline' : 'attachment'
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function contentType(upstreamType: string | null, name: string) {
  const isGeneric = !upstreamType || upstreamType.startsWith('application/octet-stream')
  if (isGeneric && /\.pdf$/i.test(name)) return 'application/pdf'
  return upstreamType ?? 'application/pdf'
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const inline = request.nextUrl.searchParams.get('inline') === '1'
  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await context.params
  const [material] = await db
    .select({ externalKey: materials.externalKey })
    .from(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId)))
    .limit(1)

  const match = material?.externalKey ? KEY_PATTERN.exec(material.externalKey) : null
  if (!match) {
    return NextResponse.json({ error: 'Este documento no tiene un archivo original.' }, { status: 404 })
  }

  try {
    const info = await getOriginalFileInfo(match[1] as 'material' | 'exam', Number(match[2]))
    if (!info) {
      return NextResponse.json({ error: 'La FCEIA no tiene el archivo.' }, { status: 404 })
    }

    const upstream = await fetchOriginalFile(info.path)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'No pude descargar el archivo.' }, { status: 502 })
    }

    const name = withExtension(info.filename)
    const headers = new Headers({
      'Content-Type': contentType(upstream.headers.get('content-type'), name),
      'Content-Disposition': contentDisposition(name, inline),
      'Cache-Control': 'private, max-age=3600',
    })
    const length = upstream.headers.get('content-length')
    if (length) headers.set('Content-Length', length)

    return new Response(upstream.body, { headers })
  } catch (error) {
    console.error('[materials] file download failed', error)
    return NextResponse.json({ error: 'No pude consultar la FCEIA.' }, { status: 502 })
  }
}
