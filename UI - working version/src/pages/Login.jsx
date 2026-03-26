// ======================== Login Page ========================
// Login -> Authenticated entry point. Validates form, POSTs to /api/login,
//          stores token via AuthContext, and redirects by role.
// ||
// ||
// ||
// Functions/Methods -> Login() -> Main component
// ||                 |
// ||                 |---> validate()        -> Client-side email + password validation
// ||                 |---> redirectByRole()  -> Navigate to role-specific route after login
// ||                 |---> handleSubmit()    -> Validate -> POST /api/login -> login() -> redirect
// ||                 |---> handleChange()    -> Update form field -> Clear field error on change
// ||                 |
// ||                 |---> Logic Flow -> Component render:
// ||                                  |
// ||                                  |--- validate()
// ||                                  |    ├── IF email empty or invalid format -> Add email error
// ||                                  |    └── IF password empty or < 8 chars  -> Add password error
// ||                                  |
// ||                                  |--- handleSubmit()
// ||                                  |    ├── validate() -> IF errors -> setErrors + return
// ||                                  |    ├── POST /api/login with email + password
// ||                                  |    ├── IF res.ok -> login(token, user) -> redirectByRole()
// ||                                  |    ├── IF res not ok -> Set email error from data.error
// ||                                  |    └── IF network error -> Set server error message
// ||                                  |
// ||                                  |--- redirectByRole()
// ||                                  |    ├── admin     -> /admin
// ||                                  |    ├── superuser -> /superuser
// ||                                  |    ├── agent     -> /agent
// ||                                  |    └── default   -> /welcome
// ||                                  |
// ||                                  |--- Render -> Background glows + back button + glass card
// ||                                  |    ├── Logo + heading
// ||                                  |    ├── Email + Password inputs with errors
// ||                                  |    ├── Remember me + Forgot password
// ||                                  |    └── Submit button + Sign up link
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import Logo   from '../components/common/Logo.jsx'
import Input  from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
const Login = () => {

  // ---------------------------------------------------------------
  // SECTION: STATE & HOOKS
  // ---------------------------------------------------------------
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()

  const [form,    setForm]    = useState({ email: '', password: '' })
  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)

  // ---------------------------------------------------------------
  // SECTION: HELPERS
  // ---------------------------------------------------------------

  // validate -> Returns error map for email + password fields
  const validate = () => {
    const errs = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email)                       errs.email    = 'Email is required'
    else if (!emailRegex.test(form.email)) errs.email    = 'Enter a valid email'
    if (!form.password)                    errs.password = 'Password is required'
    else if (form.password.length < 8)     errs.password = 'Minimum 8 characters'
    return errs
  }

  // redirectByRole -> Navigate to role-specific dashboard after login
  const redirectByRole = (user) => {
    if (user?.role === 'admin')     return navigate('/admin',     { replace: true })
    if (user?.role === 'superuser') return navigate('/superuser', { replace: true })
    if (user?.role === 'agent')     return navigate('/agent',     { replace: true })
    return navigate('/welcome', { replace: true })  // Default -> user role
  }

  // ---------------------------------------------------------------
  // SECTION: EVENT HANDLERS
  // ---------------------------------------------------------------

  // handleSubmit -> Validate -> POST login -> Store token -> Redirect by role
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return  // Guard -> Abort if validation fails

    setLoading(true)
    try {
      const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()

      if (res.ok) {
        login(data.token, data.user)  // Persist token + user to AuthContext + localStorage
        redirectByRole(data.user)
      } else {
        setErrors({ email: data.error || 'Login failed' })  // API error message
      }
    } catch {
      setErrors({ email: 'Server error. Try again later.' })  // Network failure
    } finally {
      setLoading(false)
    }
  }

  // handleChange -> Update form field + clear its error on keystroke
  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    if (errors[field]) setErrors({ ...errors, [field]: '' })
  }

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-brand-bg bg-noise flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background glows -> Decorative blur orbs */}
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-brand-accent/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-brand-violet/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Back button -> Animated slide-in from left */}
      <motion.button
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/')} whileHover={{ x: -3 }}
        className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-medium text-brand-muted hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
      >
        <ArrowLeft size={15} /> Back to home
      </motion.button>

      {/* Card -> Fade + slide up on mount */}
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }} className="w-full max-w-md z-10"
      >
        <div className="glass-card rounded-2xl p-8 sm:p-10">
          <div className="flex flex-col gap-6">

            {/* Header -> Logo + title */}
            <div className="flex flex-col items-center gap-3">
              <Logo />
              <h1 className="text-2xl font-bold text-white mt-4">Welcome back</h1>
              <p className="text-sm text-brand-muted">Sign in to your account</p>
            </div>

            {/* Form -> Email + Password + Remember me + Submit */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input id="email"    label="Email"    type="email"    placeholder="you@company.com" value={form.email}    onChange={handleChange('email')}    error={errors.email}    />
              <Input id="password" label="Password" type="password" placeholder="••••••••"        value={form.password} onChange={handleChange('password')} error={errors.password} />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent" />
                  <span className="text-xs text-brand-muted">Remember me</span>
                </label>
                <a href="#" className="text-xs text-brand-accent hover:text-brand-accent-hover transition-colors">Forgot password?</a>
              </div>

              {/* Submit -> Shows spinner label while loading */}
              <Button type="submit" variant="primary" className="w-full justify-center mt-2" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            {/* Footer -> Link to register */}
            <p className="text-center text-sm text-brand-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-brand-accent hover:text-brand-accent-hover font-medium transition-colors">Sign up</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login