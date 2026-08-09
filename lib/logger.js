const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  info: (...args) => {
    if (isDev) console.log('[info]', new Date().toISOString(), ...args)
  },
  warn: (...args) => console.warn('[warn]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[error]', new Date().toISOString(), ...args),
}
