'use client'

import { useState, type RefObject } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const INLINED_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'font-family',
  'font-size',
  'font-weight',
]
const SCALE = 2

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo renderizar el roadmap.'))
    image.src = url
  })
}

async function exportPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const sources = [svg, ...Array.from(svg.querySelectorAll('*'))]
  const targets = [clone, ...Array.from(clone.querySelectorAll('*'))]

  sources.forEach((source, index) => {
    const computed = getComputedStyle(source)
    const target = targets[index] as SVGElement
    INLINED_PROPERTIES.forEach((property) =>
      target.style.setProperty(property, computed.getPropertyValue(property)),
    )
  })

  const { width, height } = svg.viewBox.baseVal
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const markup = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width * SCALE
    canvas.height = height * SCALE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas no disponible.')

    context.fillStyle = getComputedStyle(document.body).backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('No se pudo generar la imagen.')

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function DownloadRoadmapButton({
  svgRef,
  filename,
}: {
  svgRef: RefObject<SVGSVGElement | null>
  filename: string
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleClick = async () => {
    if (!svgRef.current) return
    setBusy(true)
    setFailed(false)
    try {
      await exportPng(svgRef.current, filename)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        Descargar imagen
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          No se pudo exportar.
        </span>
      )}
    </div>
  )
}
