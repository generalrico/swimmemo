import { Router } from 'express'
import { MemWal } from '@mysten-incubation/memwal'
import { readTatumSuiObject, tatumSuiError, TATUM_SUI_HOST } from '../tatum-sui.mjs'

const router = Router()

// Dedicated SwimMemo namespace for memory isolation
export const SWIMMEMO_NAMESPACE = 'swimmemo_v1'

// In-memory job state cache so page refreshes never cause duplicate submissions
// Map<jobId, { jobId, status, blobId, text, createdAt, updatedAt, error, approvedBy }>
const activeJobs = new Map()

// Helper to check owner authentication for protected routes
function verifyOwnerAuth(req) {
  const configuredOwnerSecret = process.env.OWNER_SECRET || process.env.MEMWAL_OWNER_KEY
  // If an owner secret is configured in the environment, enforce it
  if (configuredOwnerSecret) {
    const provided = req.headers['x-owner-token'] || req.query.ownerToken
    if (!provided || provided !== configuredOwnerSecret) {
      return false
    }
  }
  return true
}

// Helper to instantiate MemWal instance safely
function getMemWalClient() {
  const key = process.env.MEMWAL_PRIVATE_KEY
  const accountId = process.env.MEMWAL_ACCOUNT_ID
  const serverUrl = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz'

  if (!key || !accountId) {
    return {
      client: null,
      error: 'Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID in server environment',
      details: {
        keyPresent: Boolean(key),
        accountPresent: Boolean(accountId),
        serverUrl
      }
    }
  }

  try {
    const client = MemWal.create({
      key,
      accountId,
      serverUrl,
      namespace: SWIMMEMO_NAMESPACE,
      requestTimeoutMs: 25000,
      recallTimeoutMs: 15000,
    })
    return { client, serverUrl, accountId }
  } catch (err) {
    return {
      client: null,
      error: err.message || 'Failed to initialize MemWal SDK client',
      details: {
        keyPresent: Boolean(key),
        accountPresent: Boolean(accountId),
        serverUrl
      }
    }
  }
}

// 1. Connection & Health check
// Distinguishes: configuration_missing, init_error, server_unreachable, connected_healthy
router.get('/health', async (_req, res) => {
  const keyConfigured = Boolean(process.env.MEMWAL_PRIVATE_KEY)
  const accountConfigured = Boolean(process.env.MEMWAL_ACCOUNT_ID)
  const serverUrl = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz'
  const ownerAuthRequired = Boolean(process.env.OWNER_SECRET || process.env.MEMWAL_OWNER_KEY)

  // Unconfigured state
  if (!keyConfigured || !accountConfigured) {
    return res.json({
      status: 'configuration_missing',
      reachability: 'untested',
      authenticated: false,
      serverUrl,
      keyConfigured,
      accountConfigured,
      ownerAuthRequired,
      namespace: SWIMMEMO_NAMESPACE,
      message: 'MEMWAL_ACCOUNT_ID or MEMWAL_PRIVATE_KEY is not injected into the preview container runtime.'
    })
  }

  const { client, error } = getMemWalClient()
  if (!client) {
    return res.json({
      status: 'init_error',
      reachability: 'failed',
      authenticated: false,
      serverUrl,
      keyConfigured,
      accountConfigured,
      ownerAuthRequired,
      namespace: SWIMMEMO_NAMESPACE,
      error
    })
  }

  try {
    // MemWal health() tests relayer reachability (unauthenticated preflight)
    const healthResult = await client.health()
    // Signed read verifies the delegate; health() alone is unauthenticated.
    await client.recall({ query: 'SwimMemo connection check', limit: 1 })
    res.json({
      status: 'connected_healthy',
      reachability: 'reachable',
      authenticated: true,
      serverUrl,
      keyConfigured: true,
      accountConfigured: true,
      ownerAuthRequired,
      namespace: SWIMMEMO_NAMESPACE,
      health: healthResult
    })
  } catch (err) {
    res.json({
      status: [401, 403].includes(err.status) ? 'authentication_failed' : 'server_unreachable',
      reachability: [401, 403].includes(err.status) ? 'reachable' : 'unreachable',
      authenticated: false,
      serverUrl,
      keyConfigured: true,
      accountConfigured: true,
      ownerAuthRequired,
      namespace: SWIMMEMO_NAMESPACE,
      error: err.message || 'Failed to reach Walrus Memory relayer server'
    })
  }
})

// 2. Remember: Save swimmer-approved memory using remember() / rememberAsync()
// Must require explicit swimmer approval. Protected by owner auth.
router.post('/remember', async (req, res) => {
  if (!verifyOwnerAuth(req)) {
    return res.status(403).json({
      success: false,
      error: 'Owner authorization required. Provide matching X-Owner-Token header.'
    })
  }

  const { text, approved, idempotencyKey } = req.body
  if (approved !== true) {
    return res.status(400).json({
      success: false,
      error: 'Explicit swimmer approval is required before persisting any memory to Walrus.'
    })
  }

  if (!text || typeof text !== 'string' || !text.trim() || text.length > 10000) {
    return res.status(400).json({
      success: false,
      error: 'text is required and must not be empty.'
    })
  }

  const { client, error } = getMemWalClient()
  if (!client) {
    return res.status(503).json({
      success: false,
      error: error || 'MemWal client is not configured'
    })
  }

  try {
    // remember() triggers async acceptance on the relayer
    const accepted = await client.remember(text.trim(), {
      dedupe: true,
      idempotencyKey: idempotencyKey || undefined
    })

    const job = {
      jobId: accepted.job_id,
      status: accepted.status || 'pending',
      blobId: null,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      approvedBy: 'swimmer'
    }

    activeJobs.set(accepted.job_id, job)

    res.json({
      success: true,
      jobId: accepted.job_id,
      status: accepted.status || 'pending',
      namespace: SWIMMEMO_NAMESPACE
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to submit remember request to Walrus Memory relayer'
    })
  }
})

// 3. Status tracking of a remember job using getRememberStatus(jobId)
router.get('/job/:jobId', async (req, res) => {
  const { jobId } = req.params
  const cached = activeJobs.get(jobId)

  const { client, error } = getMemWalClient()
  if (!client) {
    return res.json({
      jobId,
      status: cached ? cached.status : 'untracked',
      blobId: cached ? cached.blobId : null,
      error: error || 'MemWal is not configured'
    })
  }

  try {
    const sdkStatus = await client.getRememberStatus(jobId)
    // sdkStatus: { job_id, status: 'pending'|'running'|'uploaded'|'done'|'failed'|'not_found', blob_id, error }
    const updated = {
      jobId,
      status: sdkStatus.status,
      blobId: sdkStatus.blob_id || (cached ? cached.blobId : null),
      text: cached ? cached.text : null,
      updatedAt: new Date().toISOString(),
      error: sdkStatus.error || null,
      confirmed: sdkStatus.status === 'done' && Boolean(sdkStatus.blob_id)
    }

    if (cached) {
      activeJobs.set(jobId, { ...cached, ...updated })
    } else {
      activeJobs.set(jobId, updated)
    }

    res.json({
      success: true,
      job: updated
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Error checking job status'
    })
  }
})

// 4. Recall: Retrieve memories using recall()
router.post('/recall', async (req, res) => {
  if (!verifyOwnerAuth(req)) {
    return res.status(403).json({
      success: false,
      error: 'Owner authorization required.'
    })
  }

  const { query, limit = 5 } = req.body
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: 'query is required.'
    })
  }

  const { client, error } = getMemWalClient()
  if (!client) {
    return res.status(503).json({
      success: false,
      error: error || 'MemWal client is not configured'
    })
  }

  try {
    const recallResult = await client.recall({
      query: query.trim(),
      limit: Math.max(1, Math.min(Math.floor(Number(limit)) || 5, 20)),
      sort: 'recent'
    })

    res.json({
      success: true,
      query,
      namespace: SWIMMEMO_NAMESPACE,
      total: recallResult.total,
      results: recallResult.results || []
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to recall memories from Walrus relayer'
    })
  }
})

// 5. List tracked jobs from session cache
router.get('/jobs', async (_req, res) => {
  const jobsArray = Array.from(activeJobs.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  res.json({
    jobs: jobsArray
  })
})

// Read the configured account through Tatum's supported native gRPC gateway.
router.get('/sui/inspect-account', async (_req, res) => {
  const accountId = process.env.MEMWAL_ACCOUNT_ID?.trim()
  if (!accountId) return res.status(503).json({ status: 'missing_account_id', message: 'MEMWAL_ACCOUNT_ID is not configured.' })
  try {
    const response = await readTatumSuiObject(accountId)
    return res.json({ status: 'success', protocol: 'grpc', endpoint: TATUM_SUI_HOST, accountId, rpcResponse: response })
  } catch (error) {
    const { httpStatus, ...details } = tatumSuiError(error)
    return res.status(httpStatus).json({ ...details, protocol: 'grpc', endpoint: TATUM_SUI_HOST, accountId })
  }
})

export default router
