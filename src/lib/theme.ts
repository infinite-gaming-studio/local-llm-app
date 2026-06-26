type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  const stored = localStorage.getItem('llm-app:theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(t: Theme) {
  localStorage.setItem('llm-app:theme', t)
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
