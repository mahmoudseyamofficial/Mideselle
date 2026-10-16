import { createClient } from '@/lib/supabase/server'
import { NotificationsMenu, type NotificationItem } from '@/components/notifications-menu'
import type { Locale } from '@/lib/i18n/dictionaries'

export async function NotificationsBell({ role, locale }: { role: string; locale: Locale }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(15)
  if (error) console.error('[notifications] query failed:', error.message)
  return <NotificationsMenu items={(data ?? []) as NotificationItem[]} role={role} locale={locale} />
}