import 'server-only'
import { cookies } from 'next/headers'
import { dictionaries, LOCALE_COOKIE, type Locale } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return value === 'en' ? 'en' : 'ar'
}

export async function getDictionary() {
  const locale = await getLocale()
  return { locale, t: dictionaries[locale] }
}
