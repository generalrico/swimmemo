import { SuiGrpcClient } from '@mysten/sui/grpc'
import { GrpcTransport } from '@protobuf-ts/grpc-transport'
import { ChannelCredentials } from '@grpc/grpc-js'
import { MissingApiKeyError } from './tatum-client.mjs'

export const TATUM_SUI_HOST = 'sui-mainnet-grpc.gateway.tatum.io:443'

function nativeTransport() {
  return new GrpcTransport({ host: TATUM_SUI_HOST, channelCredentials: ChannelCredentials.createSsl() })
}

// Convert protobuf integer fields losslessly for Express/JSON.
function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString()
    if (item instanceof Uint8Array) return Buffer.from(item).toString('base64')
    return item
  }))
}

async function withClient(operation, { transportFactory = nativeTransport } = {}) {
  const key = process.env.TATUM_API_KEY?.trim()
  if (!key) throw new MissingApiKeyError()
  const transport = transportFactory()
  try {
    const client = new SuiGrpcClient({ network: 'mainnet', transport })
    return await operation(client, { meta: { 'x-api-key': key }, timeout: 15000 })
  } finally {
    transport.close()
  }
}

export async function readTatumSuiObject(objectId, options) {
  if (typeof objectId !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(objectId.trim())) {
    throw Object.assign(new Error('Expected a Sui object ID beginning with 0x.'), { code: 'INVALID_ARGUMENT' })
  }
  return withClient(async (client, callOptions) => {
    const { response } = await client.ledgerService.getObject({
      objectId: objectId.trim(),
      readMask: { paths: ['object_id', 'version', 'digest', 'object_type', 'owner'] }
    }, callOptions)
    if (!response.object?.objectId) throw new Error('Tatum returned no object; inspection is not verified.')
    return jsonSafe(response)
  }, options)
}

export async function readTatumSuiCheckpoint(options) {
  return withClient(async (client, callOptions) => {
    const { response } = await client.ledgerService.getCheckpoint({
      checkpointId: { oneofKind: undefined },
      readMask: { paths: ['sequence_number', 'digest'] }
    }, callOptions)
    if (response.checkpoint?.sequenceNumber == null) throw new Error('Tatum returned no checkpoint.')
    return jsonSafe(response)
  }, options)
}

export function tatumSuiError(error) {
  const code = error.code
  if (error instanceof MissingApiKeyError) return { httpStatus: 503, status: 'missing_tatum_key', message: error.message }
  if (['UNAUTHENTICATED', 'PERMISSION_DENIED', 16, 7].includes(code)) return { httpStatus: 502, status: 'tatum_auth_error', grpcCode: code, message: 'Tatum rejected the API key or its permissions. Check the Mainnet key in the server environment.' }
  if (['NOT_FOUND', 5].includes(code)) return { httpStatus: 404, status: 'object_not_found', grpcCode: code, message: 'Tatum gRPC could not find this object on its node. This is separate from your working Walrus Memory connection.' }
  if (['INVALID_ARGUMENT', 3].includes(code)) return { httpStatus: 400, status: 'invalid_request', grpcCode: code, message: error.message }
  return { httpStatus: 502, status: 'grpc_error', grpcCode: code || 'UNKNOWN', message: error.message || 'Tatum gRPC request failed.' }
}
