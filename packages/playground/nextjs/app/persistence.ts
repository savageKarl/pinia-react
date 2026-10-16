export const preferenceKey = 'pinia:preferences'
export const preferenceCookieKeys = [preferenceKey] as const
export const preferenceDefaults = { name: 'Ada', theme: 'light' as 'light' | 'dark', note: '' }
