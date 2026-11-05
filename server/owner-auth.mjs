import { timingSafeEqual } from 'node:crypto'

// All server APIs share one owner gate in this single-owner demo.
export function ownerAuth(req, res, next) {
  const secret = process.env.OWNER_SECRET || process.env.MEMWAL_OWNER_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ status: 'owner_setup_required', error: 'Configure OWNER_SECRET on the server before using live memory.', ownerAuthRequired: true })
    }
    return next()
  }
  const provided = req.get('X-Owner-Token') || ''
  const actual = Buffer.from(provided)
  const expected = Buffer.from(secret)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(403).json({ status: 'owner_authorization_required', error: 'Enter your owner token in Profile & Secrets Setup, then retry.', ownerAuthRequired: true })
  }
  next()
}
