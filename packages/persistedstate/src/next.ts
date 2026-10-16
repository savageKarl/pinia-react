import type { PiniaPlugin, PiniaPluginContext } from 'pinia-react'
import { createPersistencePlugin } from './persistedstate'
import type { PluginOptions, StorageLike } from './types'

/** Decoded serialized values, keyed by final logical persistence key. Transfer only allowlisted preferences. */
export type CookieSnapshot = Readonly<Record<string, string | null>>

/** Next.js cookies() reader: values are already URI-decoded by the framework. */
export interface CookieReader {
  get: (name: string) => { value: string } | undefined
}

export interface CookieOptions {
  /** Cookie visibility path. @default '/' */
  path?: string
  /** Omit for a host-only cookie. */
  domain?: string
  /** Lifetime in seconds. Omitted: session cookie. */
  maxAge?: number
  /** @default 'lax' */
  sameSite?: 'lax' | 'strict' | 'none'
  /** @default true on HTTPS, false on HTTP */
  secure?: boolean
}

/** Cookie-only adapter. Store-level storage overrides are reported as strategy errors. */
export interface CookiePersistenceOptions extends Omit<PluginOptions, 'storage'> {
  /** Required request snapshot, used for every Store's first restore on server AND client. */
  cookies: CookieSnapshot
  cookieOptions?: CookieOptions
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // Preserve malformed input for the strategy's normal deserialize/error path.
    return value
  }
}

/** Await cookies() in a Server Component, then select only final keys (after global transforms). */
export function readCookieSnapshot(reader: CookieReader, keys: readonly string[]): CookieSnapshot {
  return Object.fromEntries(
    keys.map((key) => {
      const cookie = reader.get(encodeURIComponent(key))
      return [key, cookie ? cookie.value : null]
    })
  )
}

function readBrowserCookie(key: string): string | null {
  const name = `${encodeURIComponent(key)}=`
  const item = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(name))
  return item === undefined ? null : decode(item.slice(name.length))
}

function serializeCookie(key: string, value: string, options: CookieOptions): string {
  const name = encodeURIComponent(key)
  if (!name) throw new TypeError('Cookie persistence requires a nonempty key')
  const { path = '/', domain, maxAge, sameSite = 'lax', secure = location.protocol === 'https:' } = options
  if (
    !path.startsWith('/') ||
    [...path].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) >= 127 || char === ';')
  )
    throw new TypeError('Invalid cookie path')
  if (domain !== undefined && !/^\.?[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(domain))
    throw new TypeError('Invalid cookie domain')
  if (maxAge !== undefined && (!Number.isSafeInteger(maxAge) || maxAge < 0))
    throw new TypeError('Invalid cookie maxAge')
  if (!['lax', 'strict', 'none'].includes(sameSite)) throw new TypeError('Invalid cookie sameSite')
  if (sameSite === 'none' && !secure) throw new TypeError('SameSite=None requires Secure')
  if (name.startsWith('__Secure-') && !secure) throw new TypeError('__Secure- cookies require Secure')
  if (name.startsWith('__Host-') && (!secure || domain !== undefined || path !== '/'))
    throw new TypeError('__Host- cookies require Secure, Path=/ and no Domain')
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`]
  if (domain !== undefined) parts.push(`Domain=${domain}`)
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`)
  if (secure) parts.push('Secure')
  const cookie = parts.join('; ')
  // Encoded name/value and validated attributes are ASCII; count the entire assignment conservatively.
  if (cookie.length > 4096) throw new RangeError('Persisted cookie exceeds 4096 bytes; select fewer fields')
  return cookie
}

/**
 * Restore the same explicit request snapshot during SSR and initial client creation.
 * Later commits write browser cookies; server operations never set response cookies.
 * Create this per Provider/request, not at module scope with request data.
 */
export function createCookiePersistedState({
  cookies,
  cookieOptions = {},
  ...options
}: CookiePersistenceOptions): PiniaPlugin {
  const snapshot = Object.fromEntries(Object.entries(cookies))
  const attributes = { ...cookieOptions }
  return (context: PiniaPluginContext) => {
    let initialRestore = true
    const storage: StorageLike = {
      getItem: (key) => {
        if (!key) throw new TypeError('Cookie persistence requires a nonempty key')
        return initialRestore || typeof document === 'undefined'
          ? Object.hasOwn(snapshot, key)
            ? snapshot[key]
            : null
          : readBrowserCookie(key)
      },
      setItem: (key, value) => {
        // biome-ignore lint/suspicious/noDocumentCookie: Synchronous Web Storage-compatible writes cannot use the async Cookie Store API.
        if (typeof document !== 'undefined') document.cookie = serializeCookie(key, value, attributes)
      }
    }
    const plugin = createPersistencePlugin(options, (strategy) => {
      if (strategy.storage !== undefined)
        throw new TypeError('Cookie persistence does not accept per-strategy storage overrides')
      return storage
    })
    try {
      return plugin(context)
    } finally {
      initialRestore = false
    }
  }
}
