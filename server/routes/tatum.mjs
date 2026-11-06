import { Router } from 'express'
import { tatumApiBase, tatumFetch, MissingApiKeyError } from '../tatum-client.mjs'

import { readTatumSuiObject, readTatumSuiCheckpoint, tatumSuiError } from '../tatum-sui.mjs'

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

// Sui inspection uses native gRPC; the retired JSON-RPC gateway is not called.
router.post('/sui/verify-object', async (req, res) => {
  if (req.body.network && req.body.network !== 'mainnet') return res.status(400).json({ status: 'invalid_network', message: 'This demo uses Sui mainnet.' })
  try {
    const response = await readTatumSuiObject(req.body.objectId)
    res.json({ status: 'success', network: 'mainnet', protocol: 'grpc', rpcResponse: response })
  } catch (error) {
    const { httpStatus, ...details } = tatumSuiError(error)
    res.status(httpStatus).json(details)
  }
})

router.get('/sui/state', async (_req, res) => {
  try {
    const response = await readTatumSuiCheckpoint()
    res.json({ status: 'connected', protocol: 'grpc', latestCheckpoint: response.checkpoint.sequenceNumber })
  } catch (error) {
    const { httpStatus, ...details } = tatumSuiError(error)
    res.status(httpStatus).json(details)
  }
})

export default router
