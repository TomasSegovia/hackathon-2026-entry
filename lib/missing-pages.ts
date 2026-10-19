/** Explains why a source has no page numbers, based on what kind of document it is. */
export function missingPagesNote(materialKind: string | null | undefined) {
  if (materialKind === 'examen_anterior') {
    return 'Examen escaneado, sin numeración de páginas: buscalo por su fecha o título.'
  }
  if (materialKind === 'bibliografia') {
    return 'Ficha o libro sin páginas disponibles: buscá el capítulo o el tema por su título.'
  }
  return 'Sin numeración de páginas en este documento: buscá el tema por su título. Si lo importaste de la FCEIA hace tiempo, usá «Actualizar páginas» en la materia.'
}
