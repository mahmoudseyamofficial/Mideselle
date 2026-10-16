    'use client'

    import { useState } from 'react'
    import Link from 'next/link'
    import { useRouter } from 'next/navigation'
    import { Bell } from 'lucide-react'
    import { createClient } from '@/lib/supabase/client'
    import { cn } from '@/lib/utils'
    import { notificationHref, notificationText } from '@/lib/notifications'
    import {
    isRequestKind,
    requestNotificationHref,
    requestNotificationText,
    } from '@/lib/request-notifications'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import type { Locale } from '@/lib/i18n/dictionaries'

    export type NotificationItem = {
    id: string
    kind: string
    data?: Record<string, unknown> | null
    read_at: string | null
    created_at: string
    }

    export function NotificationsMenu({ items, role, locale }: { items: NotificationItem[]; role: string; locale: Locale }) {
    const x = RENTAL_TEXT[locale]
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const unread = items.filter((i) => !i.read_at).length

    async function markRead(id: string) {
        await createClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
        router.refresh()
    }

    async function markAll() {
        await createClient().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
        router.refresh()
    }

    return (
        <div className="relative">
        <button
            type="button"
            aria-label={x.notifications}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative flex size-9 items-center justify-center rounded-md hover:bg-muted"
        >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 && (
            <span className="absolute -top-0.5 -inset-e-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unread > 9 ? '9+' : unread}
            </span>
            )}
        </button>

        {open && (
            <>
            <button type="button" tabIndex={-1} aria-hidden="true" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <div className="absolute inset-e-0 z-50 mt-2 w-80 max-w-[85vw] rounded-xl border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-medium">{x.notifications}</span>
                {unread > 0 && (
                    <button type="button" onClick={markAll} className="text-xs text-primary hover:underline">
                    {x.markAllRead}
                    </button>
                )}
                </div>
                {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{x.noNotifications}</p>
                ) : (
                <ul className="max-h-96 overflow-y-auto">
                    {items.map((n) => {
                    // New request notifications carry the device name in `data`; older kinds use lib/notifications.ts
                    const href = isRequestKind(n.kind) ? requestNotificationHref(n.kind) : notificationHref(n.kind, role)
                    const text = isRequestKind(n.kind)
                        ? requestNotificationText(locale, n.kind, n.data)
                        : notificationText(locale, n.kind)

                    return (
                        <li key={n.id}>
                        <Link
                            href={href}
                            onClick={() => {
                            setOpen(false)
                            if (!n.read_at) void markRead(n.id)
                            }}
                            className={cn('flex flex-col gap-1 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted', !n.read_at && 'bg-primary/5')}
                        >
                            <span className="text-pretty">{text}</span>
                            <span className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')}
                            </span>
                        </Link>
                        </li>
                    )
                    })}
                </ul>
                )}
            </div>
            </>
        )}
        </div>
    )
    }