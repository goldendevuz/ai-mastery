import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, useAuth } from '../lib/auth'
import { modules } from '../data/curriculum'
import { ASSESSMENT, hasAssessment, isPublished, lessonId } from '../lib/content'
import NotFound from './NotFound'

interface Row {
  id: number
  name: string
  email: string
  open: string[]
}

export default function Teacher() {
  const { ready, user } = useAuth()
  const [students, setStudents] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role !== 'teacher') return
    api<{ students: Row[] }>('/api/admin/access')
      .then((r) => {
        setStudents(r.students)
        setSelectedId((id) => id ?? r.students[0]?.id ?? null)
        setLoaded(true)
      })
      .catch((e) => setError(e.message))
  }, [user])

  if (!ready) return null
  if (user?.role !== 'teacher') return <NotFound />

  const selected = students.find((s) => s.id === selectedId)
  const open = new Set(selected?.open)

  async function toggle(ids: string[], value: boolean) {
    if (!selected) return
    setError('')
    try {
      const r = await api<{ student_id: number; open: string[] }>('/api/admin/access', {
        method: 'PUT',
        body: JSON.stringify({ student_id: selected.id, lesson_ids: ids, open: value }),
      })
      setStudents((list) => list.map((s) => (s.id === r.student_id ? { ...s, open: r.open } : s)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="font-serif text-3xl font-medium">Teacher panel</h1>
      <p className="mt-2 text-sm text-muted">
        Pick a student, then open or close lessons for them. Every lesson stays closed to a student until you open it;
        the server enforces this.
      </p>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <h2 className="mt-8 text-lg font-semibold">Students ({students.length})</h2>
      {loaded && students.length === 0 && <p className="mt-3 text-sm text-muted">No students yet.</p>}
      <ul className="mt-3 flex flex-wrap gap-2">
        {students.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setSelectedId(s.id)}
              aria-pressed={s.id === selectedId}
              className={`rounded-xl border px-4 py-2 text-left text-sm ${
                s.id === selectedId ? 'border-accent bg-sunken' : 'border-line bg-surface hover:bg-sunken'
              }`}
            >
              <span className="block font-medium">{s.name}</span>
              <span className="block text-xs text-faint">
                {s.email} · {s.open.length} open
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">Lessons for {selected.name}</h2>
          {modules.map((m) => {
            const items = [
              ...m.topics.filter((t) => isPublished(m.slug, t.slug)).map((t) => ({ id: lessonId(m.slug, t.slug), title: t.title })),
              ...(hasAssessment(m) ? [{ id: lessonId(m.slug, ASSESSMENT), title: 'Module quiz' }] : []),
            ]
            if (!items.length) return null
            const count = items.filter((i) => open.has(i.id)).length
            return (
              <section key={m.slug} className="rounded-xl border border-line bg-surface">
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <h2 className="flex-1 text-sm font-semibold">
                    {m.n}. {m.title}
                    <span className="ml-2 font-mono text-xs font-normal text-faint">
                      {count}/{items.length} open
                    </span>
                  </h2>
                  <button onClick={() => toggle(items.map((i) => i.id), true)} className="text-xs text-accent hover:underline">
                    Open all
                  </button>
                  <button onClick={() => toggle(items.map((i) => i.id), false)} className="text-xs text-muted hover:underline">
                    Close all
                  </button>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((i) => (
                    <li key={i.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-[14px] hover:bg-sunken">
                        <input type="checkbox" checked={open.has(i.id)} onChange={(e) => toggle([i.id], e.target.checked)} />
                        <span className="flex-1">{i.title}</span>
                        <span className={`text-xs ${open.has(i.id) ? 'text-accent' : 'text-faint'}`}>
                          {open.has(i.id) ? 'open' : 'closed'}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <Link to="/" className="mt-8 inline-block text-sm text-accent hover:underline">
        Back to the course
      </Link>
    </div>
  )
}
