import { useEffect, useState } from 'react'
import { deleteSession, getSession } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'

type AppState = 'loading' | 'login' | 'authenticated' | 'demo'

export function App() {
  const [state, setState] = useState<AppState>('loading')

  useEffect(() => {
    getSession()
      .then(({ authenticated }) => setState(authenticated ? 'authenticated' : 'login'))
      .catch(() => setState('login'))
  }, [])

  async function logout() {
    if (state === 'authenticated') await deleteSession().catch(() => undefined)
    setState('login')
  }

  if (state === 'loading') return <div className="app-loading"><span>K</span></div>
  if (state === 'login') return <Login onLogin={() => setState('authenticated')} onDemo={() => setState('demo')} />
  return <Dashboard demo={state === 'demo'} onLogout={logout} />
}
