'use client'

import { useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/app/actions'

interface ActionButtonProps {
  action: () => Promise<ActionResult>
  children: ReactNode
  successMessage: string
  notImplementedMessage: string
  errorMessage: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  icon?: ReactNode
}

export function ActionButton({
  action,
  children,
  successMessage,
  notImplementedMessage,
  errorMessage,
  variant = 'default',
  icon,
}: ActionButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant={variant}
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action()
          if (result.ok) {
            toast.success(successMessage)
            router.refresh()
          } else {
            toast.error(result.error === 'not_implemented' ? notImplementedMessage : errorMessage)
          }
        })
      }
    >
      {pending ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </Button>
  )
}
