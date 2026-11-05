import { Router } from 'express'
import { tatumApiBase, tatumFetch, tatumRpc, MissingApiKeyError } from '../tatum-client.mjs'

const router = Router()

// Health check — a present key says nothing about egress, so make a real request.
router.get('/status', async (_req, res) => {
  if (!process.env.TATUM_API_KEY) return res.json({ status: 'no-api-key' })
  try {
    // Any HTTP response proves Tatum is reachable; the status code doesn't matter.
    await fetch(tatumApiBase(), { signal: AbortSignal.timeout(8000) })
    res.json({ status: 'connected' })
  } catch (error) {
    res.json({ status: 'egress-failed', error: error.message })
  }
})

// Walrus uploads listing via Tatum Data API /v4/data/storage/uploads
router.get('/storage/uploads', async (req, res) => {
  if (!process.env.TATUM_API_KEY) {
    return res.json({
      status: 'no-api-key',
      message: 'TATUM_API_KEY is not configured in workspace environment. Set TATUM_API_KEY to access live Walrus storage.',
      uploads: []
    })
  }

  try {
    const limit = req.query.limit || 50
    const offset = req.query.offset || 0
    const resp = await tatumFetch(`/v4/data/storage/uploads?limit=${limit}&offset=${offset}`)
    if (!resp.ok) {
      const errText = await resp.text()
      return res.status(resp.status).json({
        status: 'error',
        statusCode: resp.status,
        message: errText || 'Failed to list Walrus uploads from Tatum Data API',
        uploads: []
      })
    }
    const data = await resp.json()
    res.json({
      status: 'connected',
      uploads: Array.isArray(data) ? data : []
    })
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.json({
        status: 'no-api-key',
        message: 'TATUM_API_KEY is missing.',
        uploads: []
      })
    }
    res.status(500).json({
      status: 'error',
      message: error.message || 'Internal error listing Walrus uploads',
      uploads: []
    })
  }
})

// Walrus upload status check by jobId
router.get('/storage/upload/:jobId', async (req, res) => {
  if (!process.env.TATUM_API_KEY) {
    return res.status(401).json({ error: 'TATUM_API_KEY is not set' })
  }
  try {
    const resp = await tatumFetch(`/v4/data/storage/upload/${encodeURIComponent(req.params.jobId)}`)
    if (!resp.ok) {
      const errText = await resp.text()
      return res.status(resp.status).json({ error: errText })
    }
    const data = await resp.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Retired: live memories must use the approved MemWal flow.
router.post('/storage/upload', (_req, res) => res.status(410).json({ error: 'Use /api/memwal/remember with explicit approval.' }))

// Verify Sui onchain object via Tatum Sui RPC (e.g. Walrus Blob object ID on Sui)
router.post('/sui/verify-object', async (req, res) => {
  if (!process.env.TATUM_API_KEY) {
    return res.status(401).json({
      status: 'no-api-key',
      message: 'TATUM_API_KEY is not set for Sui RPC verification'
    })
  }

  const { objectId, network = 'mainnet' } = req.body
  if (!objectId) {
    return res.status(400).json({ error: 'objectId is required' })
  }

  try {
    // sui_getObject is standard Sui JSON-RPC method
    const rpcBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getObject',
      params: [
        objectId,
        {
          showType: true,
          showOwner: true,
          showPreviousTransaction: true,
          showDisplay: true,
          showContent: true,
          showBcs: false,
          showStorageRebate: true
        }
      ]
    }

    const rpcRes = await tatumRpc('sui', rpcBody, network)
    if (!rpcRes.ok) {
      const errText = await rpcRes.text()
      return res.status(rpcRes.status).json({
        status: 'error',
        statusCode: rpcRes.status,
        message: errText
      })
    }

    const json = await rpcRes.json()
    res.json({
      status: 'success',
      network,
      rpcResponse: json
    })
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.status(401).json({ status: 'no-api-key', message: 'TATUM_API_KEY is missing' })
    }
    res.status(500).json({ status: 'error', message: error.message })
  }
})

// Query latest Sui checkpoint / network state
router.get('/sui/state', async (req, res) => {
  if (!process.env.TATUM_API_KEY) {
    return res.json({
      status: 'no-api-key',
      message: 'TATUM_API_KEY not configured'
    })
  }

  try {
    const rpcBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getLatestCheckpointSequenceNumber',
      params: []
    }
    const rpcRes = await tatumRpc('sui', rpcBody, 'mainnet')
    if (!rpcRes.ok) {
      const errText = await rpcRes.text()
      return res.json({ status: 'error', message: errText })
    }
    const json = await rpcRes.json()
    res.json({
      status: 'connected',
      latestCheckpoint: json.result || null,
      error: json.error || null
    })
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    })
  }
})

export default router
