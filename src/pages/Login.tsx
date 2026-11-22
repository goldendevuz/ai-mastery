import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { login, register } from '../lib/auth'

export default function Login({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isRegister) await register(name, email, password)
      else await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const input =
    'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <h1 className="font-serif text-3xl font-medium">{isRegister ? 'Create your account' : 'Log in'}</h1>
      <p className="mt-2 text-sm text-muted">
        {isRegister ? 'Sign up as a student to access the lessons your teacher has opened.' : 'Welcome back.'}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {isRegister && (
          <label className="block text-sm font-medium">
            Name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : 1}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          {isRegister && <span className="mt-1 block text-xs font-normal text-faint">At least 8 characters.</span>}
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60"
        >
          {isRegister ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link to={isRegister ? '/login' : '/register'} state={{ from }} className="font-medium text-accent hover:underline">
          {isRegister ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}
