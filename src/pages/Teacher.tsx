import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, refreshAuth, useAuth } from '../lib/auth'
import { modules } from '../data/curriculum'
import { ASSESSMENT, hasAssessment, isPublished, lessonId } from '../lib/content'
import NotFound from './NotFound'

interface Row {
  id: number
  name: string
  email: string
  role: string
}

export default function Teacher() {
  const { ready, user } = useAuth()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [people, setPeople] = useState<Row[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role !== 'teacher') return
    api<{ open: string[]; students: Row[] }>('/api/admin/access')
      .then((r) => {
        setOpen(new Set(r.open))
        setPeople(r.students)
      })
      .catch((e) => setError(e.message))
  }, [user])

  if (!ready) return null
  if (user?.role !== 'teacher') return <NotFound />

  async function toggle(ids: string[], value: boolean) {
    setError('')
    try {
      const r = await api<{ open: string[] }>('/api/admin/access', {
        method: 'PUT',
        body: JSON.stringify({ lesson_ids: ids, open: value }),
      })
      setOpen(new Set(r.open))
      refreshAuth()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const students = people.filter((p) => p.role === 'student')

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="font-serif text-3xl font-medium">Teacher panel</h1>
      <p className="mt-2 text-sm text-muted">
        Open or close lessons. For now an open lesson is available to <b>all students</b>. Lessons stay closed to
        students until you open them; the server enforces this.
      </p>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-8 space-y-4">
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

      <h2 className="mt-12 text-lg font-semibold">Students ({students.length})</h2>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
        {students.length === 0 && <li className="px-4 py-3 text-muted">No students yet.</li>}
        {students.map((s) => (
          <li key={s.id} className="px-4 py-2">
            {s.name} <span className="text-faint">· {s.email}</span>
          </li>
        ))}
      </ul>
      <Link to="/" className="mt-8 inline-block text-sm text-accent hover:underline">
        Back to the course
      </Link>
    </div>
  )
}
