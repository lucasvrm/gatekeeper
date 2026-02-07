import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { useContract, IconValue } from '../../packages/orqui/src/runtime'
import type { LoginPageConfig } from '../../packages/orqui/src/runtime/types'

// ── Helper: build inline styles from loginPage config ──
// Typography, padding, border-radius, font sizes inherit from global tokens / CSS variables.
// Only color overrides and positioning come from the loginPage config.
function useLoginStyles(cfg: LoginPageConfig) {
  return useMemo(() => {
    const bg = cfg.background || {}
    const card = cfg.card || {}
    const title = cfg.title || {}
    const inputs = cfg.inputs || {}
    const button = cfg.button || {}
    const links = cfg.links || {}
    const footer = cfg.footer || {}

    const bgType = bg.type || 'solid'
    let pageBackground = bg.color || undefined
    if (bgType === 'gradient' && bg.gradient) pageBackground = bg.gradient
    const bgImage = bgType === 'image' && bg.imageUrl ? `url(${bg.imageUrl})` : undefined

    const posMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }
    const vMap: Record<string, string> = { top: 'flex-start', center: 'center', bottom: 'flex-end' }

    return {
      page: {
        minHeight: '100vh',
        display: 'flex',
        justifyContent: posMap[card.position || 'center'] || 'center',
        alignItems: vMap[card.verticalAlign || 'center'] || 'center',
        padding: '24px',
        background: bgImage ? undefined : pageBackground,
        backgroundImage: bgImage,
        backgroundSize: bgImage ? 'cover' : undefined,
        backgroundPosition: bgImage ? 'center' : undefined,
        position: 'relative' as const,
      },
      overlay: bg.overlay ? {
        position: 'absolute' as const,
        inset: 0,
        background: bg.overlay,
        zIndex: 0,
      } : null,
      card: {
        position: 'relative' as const,
        zIndex: 1,
        width: '100%',
        maxWidth: card.maxWidth || '420px',
        background: card.background || 'hsl(var(--card))',
        border: `1px solid ${card.borderColor || 'hsl(var(--border))'}`,
        borderRadius: card.borderRadius || '8px',
        boxShadow: card.shadow || '0 8px 32px rgba(0,0,0,0.3)',
        padding: card.padding || '24px',
      },
      title: {
        textAlign: (title.align || 'center') as any,
        fontSize: '20px',
        fontWeight: '600',
        marginBottom: '20px',
      },
      label: {
        display: 'block',
        marginBottom: '4px',
        fontSize: '14px',
        fontWeight: '500',
      },
      input: {
        width: '100%',
        background: inputs.background || 'hsl(var(--input))',
        border: `1px solid ${inputs.borderColor || 'hsl(var(--border))'}`,
        borderRadius: '6px',
        color: 'hsl(var(--foreground))',
        fontSize: '14px',
        padding: '8px 12px',
        outline: 'none',
        transition: 'border-color 0.15s',
      },
      inputFocus: inputs.focusBorderColor ? { borderColor: inputs.focusBorderColor } : { borderColor: 'hsl(var(--ring))' },
      button: {
        width: '100%',
        background: button.background || 'hsl(var(--primary))',
        color: button.color || 'hsl(var(--primary-foreground))',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        padding: '10px 20px',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s',
      },
      buttonHover: button.hoverBackground || undefined,
      link: {
        color: links.color || 'hsl(var(--primary))',
        textDecoration: 'none' as const,
      },
      linkHover: links.hoverColor || undefined,
      footerText: footer.text || '',
    }
  }, [cfg])
}

// ── Styled Input with focus border ──
function StyledInput({ style, focusStyle, ...props }: any) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      style={{ ...style, ...(focused ? focusStyle : {}) }}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
    />
  )
}

// ── Styled Button with hover ──
function StyledButton({ style, hoverBg, children, ...props }: any) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      {...props}
      style={{ ...style, ...(hovered && hoverBg ? { background: hoverBg } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

// ── Styled Link ──
function StyledLink({ style, hoverColor, children, ...props }: any) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      {...props}
      style={{ ...style, ...(hovered && hoverColor ? { color: hoverColor } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

// ── Logo Renderer — reads from global logo config ──
function LogoRenderer({ globalLogo, logoCfg }: { globalLogo: any; logoCfg: any }) {
  const scale = logoCfg.scale || 1
  const align = logoCfg.align || 'center'
  const mb = logoCfg.marginBottom || '16px'
  const typo = globalLogo.typography || {}
  const fontSize = (typo.fontSize || 16) * scale
  const iconSize = (globalLogo.iconSize || 20) * scale
  const iconGap = (globalLogo.iconGap || 8) * scale
  const justifyMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }

  const textEl = (
    <span style={{
      fontSize, fontWeight: typo.fontWeight || 700,
      color: typo.color || undefined, fontFamily: typo.fontFamily || undefined,
      letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
    }}>{globalLogo.text || 'App'}</span>
  )

  let content: React.ReactNode = textEl

  if (globalLogo.type === 'image' && (globalLogo.imageUrl || globalLogo.iconUrl)) {
    content = <img src={globalLogo.imageUrl || globalLogo.iconUrl} alt="Logo" style={{ height: 32 * scale, objectFit: 'contain' }} />
  } else if (globalLogo.type === 'icon-text') {
    const icon = globalLogo.icon || ''
    content = (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: iconGap }}>
        {globalLogo.iconUrl ? (
          <img src={globalLogo.iconUrl} alt="" style={{ height: iconSize, objectFit: 'contain' }} />
        ) : (
          <IconValue icon={icon} size={iconSize} color={typo.color || 'currentColor'} />
        )}
        {textEl}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', justifyContent: justifyMap[align] || 'center',
      marginBottom: mb, position: 'relative', zIndex: 1,
    }}>
      {content}
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { user, register } = useAuth()
  const { layout } = useContract()
  const loginCfg: LoginPageConfig = (layout.structure as any).loginPage || {}
  const styles = useLoginStyles(loginCfg)
  const logoCfg = loginCfg.logo || {}
  const globalLogo = (layout.structure as any).logo || {}

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres')
      return
    }

    setIsLoading(true)
    try {
      await register(email, password, firstName, lastName)
      toast.success('Conta criada! Faca login para continuar.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no registro'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.page} data-testid="register-page">
      {styles.overlay && <div style={styles.overlay} />}

      {/* Logo above card */}
      {logoCfg.enabled !== false && logoCfg.placement === 'above-card' && (
        <LogoRenderer globalLogo={globalLogo} logoCfg={logoCfg} />
      )}

      <div style={styles.card} data-testid="register-form">
        {/* Logo inside card */}
        {logoCfg.enabled !== false && logoCfg.placement !== 'above-card' && (
          <LogoRenderer globalLogo={globalLogo} logoCfg={logoCfg} />
        )}

        {/* Title */}
        <h2 style={styles.title}>Criar conta</h2>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              borderRadius: 6, border: '1px solid rgba(229,72,77,0.3)', background: 'rgba(229,72,77,0.05)',
              padding: '10px 12px', fontSize: 13, color: '#e5484d', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="register-first-name" style={styles.label}>Nome</label>
            <StyledInput
              id="register-first-name"
              type="text"
              value={firstName}
              onChange={(e: any) => setFirstName(e.target.value)}
              placeholder="Seu nome"
              required
              autoFocus
              data-testid="first-name-input"
              style={styles.input}
              focusStyle={styles.inputFocus}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="register-last-name" style={styles.label}>Sobrenome</label>
            <StyledInput
              id="register-last-name"
              type="text"
              value={lastName}
              onChange={(e: any) => setLastName(e.target.value)}
              placeholder="Seu sobrenome"
              required
              data-testid="last-name-input"
              style={styles.input}
              focusStyle={styles.inputFocus}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="register-email" style={styles.label}>Email</label>
            <StyledInput
              id="register-email"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              data-testid="email-input"
              style={styles.input}
              focusStyle={styles.inputFocus}

            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="register-password" style={styles.label}>Senha</label>
            <StyledInput
              id="register-password"
              type="password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              placeholder="Minimo 8 caracteres"
              required
              minLength={8}
              data-testid="password-input"
              style={styles.input}
              focusStyle={styles.inputFocus}

            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="register-confirm-password" style={styles.label}>Confirmar Senha</label>
            <StyledInput
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e: any) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
              minLength={8}
              data-testid="confirm-password-input"
              style={styles.input}
              focusStyle={styles.inputFocus}

            />
          </div>

          <StyledButton
            type="submit"
            disabled={isLoading}
            data-testid="register-button"
            style={{ ...styles.button, opacity: isLoading ? 0.7 : 1 }}
            hoverBg={styles.buttonHover}
          >
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </StyledButton>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '14px' }}>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
            Ja tem uma conta?{' '}
          </span>
          <StyledLink
            to="/login"
            style={styles.link}
            hoverColor={styles.linkHover}
          >
            Fazer login
          </StyledLink>
        </div>

        {/* Footer text */}
        {styles.footerText && (
          <div style={{ textAlign: 'center', marginTop: 12, color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>
            {styles.footerText}
          </div>
        )}
      </div>
    </div>
  )
}
