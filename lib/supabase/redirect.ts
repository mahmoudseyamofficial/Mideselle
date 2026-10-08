export function safeNext(next: string | null | undefined, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

export function authRedirect(next: string) {
  // The v0 redirect proxy only exists for the preview; a deployed site must return to its own origin.
  const base =
    (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL : undefined) ??
    `${window.location.origin}/auth/callback`
  return `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`
}
