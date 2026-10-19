import { saveProgram } from '@/app/actions/subjects'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ProgramForm({
  subjectId,
  currentProgram,
}: {
  subjectId: string
  currentProgram: string | null
}) {
  return (
    <form action={saveProgram} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="program-file">Archivo del programa (PDF o texto)</Label>
        <Input
          id="program-file"
          name="file"
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/*"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="program-text">O pegá el programa</Label>
        <Textarea
          id="program-text"
          name="text"
          rows={8}
          defaultValue={currentProgram ?? ''}
          placeholder={'Unidad 1: Sistemas de numeración\nUnidad 2: Álgebra booleana\n…'}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Guardando…">
          {currentProgram ? 'Actualizar programa' : 'Guardar programa'}
        </SubmitButton>
      </div>
    </form>
  )
}
