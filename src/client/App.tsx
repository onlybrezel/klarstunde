import { useEffect, useState } from 'react'
import { deleteSession, getSession } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { initialPlanSettings } from './navigation'

type AppState = 'loading' | 'login' | 'authenticated' | 'demo'

export function App() {
  const [state, setState] = useState<AppState>('loading')
  const [activeArea, setActiveArea] = useState('plan')
  const [plan, setPlan] = useState(initialPlanSettings)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    getSession()
      .then(({ authenticated }) => setState(authenticated ? 'authenticated' : 'login'))
      .catch(() => setState('login'))
  }, [])

  useEffect(() => {
    const expire = () => {
      setState((current) => current === 'demo' ? current : 'login')
      setExpired(true)
    }
    window.addEventListener('session-expired', expire)
    return () => window.removeEventListener('session-expired', expire)
  }, [])

  async function logout() {
    if (state === 'authenticated') await deleteSession().catch(() => undefined)
    setState('login')
    setExpired(false)
    setActiveArea('plan')
    setPlan(initialPlanSettings())
  }

  if (state === 'loading') return <div className="app-loading" role="status" aria-label="Anmeldung wird geprüft"><span aria-hidden="true">K</span></div>
  if (state === 'login') return <Login expired={expired} onLogin={() => { setExpired(false); setState('authenticated') }} onDemo={() => { setActiveArea('plan'); setPlan(initialPlanSettings()); setExpired(false); setState('demo') }} />
  return <Dashboard demo={state === 'demo'} onLogout={logout} activeArea={activeArea} onNavigate={setActiveArea} plan={plan} onPlanChange={setPlan} />
}
