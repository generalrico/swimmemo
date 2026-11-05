import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { MemWal } from '@mysten-incubation/memwal'
import routes from '../server/routes/memwal.mjs'
import { ownerAuth } from '../server/owner-auth.mjs'
import { credentialGuard } from '../server/credential-guard.mjs'

test('owner gate, authenticated health, save approval and confirmed receipts', async () => {
  const saved = { ...process.env }
  const originalCreate = MemWal.create
  process.env.NODE_ENV = 'production'
  process.env.OWNER_SECRET = 'test-owner-token-only'
  process.env.MEMWAL_PRIVATE_KEY = 'test-private-key-only'
  process.env.MEMWAL_ACCOUNT_ID = 'test-account-only'
  let failAuth = false
  let writes = 0
  MemWal.create = () => ({
    health: async () => ({ status: 'ok' }),
    recall: async () => {
      if (failAuth) throw Object.assign(new Error('Unauthorized test-private-key-only'), { status: 401 })
      return { total: 0, results: [] }
    },
    remember: async (text, options) => {
      writes++
      assert.equal(text, 'Fatigue after freestyle')
      assert.equal(options.dedupe, true)
      return { job_id: 'test-job', status: 'running' }
    },
    getRememberStatus: async () => ({ status: 'done', blob_id: 'test-blob' })
  })
  const app = express()
  app.use(express.json(), credentialGuard)
  app.use('/api', ownerAuth)
  app.use('/api/memwal', routes)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/memwal`
  const headers = { 'X-Owner-Token': process.env.OWNER_SECRET, 'Content-Type': 'application/json' }
  try {
    for (const url of ['/health', '/jobs', '/job/test-job', '/sui/inspect-account']) {
      assert.equal((await fetch(base + url)).status, 403)
    }
    const health = await (await fetch(base + '/health', { headers })).json()
    assert.equal(health.authenticated, true)
    failAuth = true
    const rejected = await (await fetch(base + '/health', { headers })).json()
    assert.equal(rejected.authenticated, false)
    assert.equal(rejected.status, 'authentication_failed')
    assert.ok(!JSON.stringify(rejected).includes(process.env.MEMWAL_PRIVATE_KEY))
    failAuth = false
    const bad = await fetch(base + '/remember', { method: 'POST', headers, body: JSON.stringify({ text: 'Fatigue after freestyle', approved: 'false' }) })
    assert.equal(bad.status, 400)
    assert.equal(writes, 0)
    const accepted = await (await fetch(base + '/remember', { method: 'POST', headers, body: JSON.stringify({ text: 'Fatigue after freestyle', approved: true, idempotencyKey: 'test-key' }) })).json()
    assert.equal(accepted.jobId, 'test-job')
    assert.equal(writes, 1)
    const job = await (await fetch(base + '/job/test-job', { headers })).json()
    assert.equal(job.job.confirmed, true)
    assert.equal(job.job.blobId, 'test-blob')
    delete process.env.OWNER_SECRET
    assert.equal((await fetch(base + '/health', { headers })).status, 503)
  } finally {
    await new Promise(resolve => server.close(resolve))
    MemWal.create = originalCreate
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
})
