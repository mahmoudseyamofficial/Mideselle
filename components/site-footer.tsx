import { getDictionary } from '@/lib/i18n/server'

export async function SiteFooter() {
  const { t } = await getDictionary()
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-foreground">{t.brand}</p>
        <p>{t.brandTagline}</p>
      </div>
    </footer>
  )
}
