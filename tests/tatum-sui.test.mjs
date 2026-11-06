import test from 'node:test'
import assert from 'node:assert/strict'
import { Server, ServerCredentials, ChannelCredentials, status } from '@grpc/grpc-js'
import { GrpcTransport } from '@protobuf-ts/grpc-transport'
import { GrpcTypes } from '@mysten/sui/grpc'
import { readTatumSuiObject, readTatumSuiCheckpoint, tatumSuiError } from '../server/tatum-sui.mjs'

function method(name, requestType, responseType) {
  return {
    path: `/sui.rpc.v2.LedgerService/${name}`,
    requestStream: false, responseStream: false,
    requestSerialize: value => Buffer.from(requestType.toBinary(value)),
    requestDeserialize: value => requestType.fromBinary(value),
    responseSerialize: value => Buffer.from(responseType.toBinary(value)),
    responseDeserialize: value => responseType.fromBinary(value)
  }
}

test('native gRPC reads objects and checkpoints, sends key metadata, preserves large integers and maps failures', async () => {
  const originalKey = process.env.TATUM_API_KEY
  process.env.TATUM_API_KEY = 'local-fixture-key'
  const server = new Server()
  let failCode
  let calls = 0
  server.addService({
    getObject: method('GetObject', GrpcTypes.GetObjectRequest, GrpcTypes.GetObjectResponse),
    getCheckpoint: method('GetCheckpoint', GrpcTypes.GetCheckpointRequest, GrpcTypes.GetCheckpointResponse)
  }, {
    getObject: (call, callback) => {
      calls++
      assert.deepEqual(call.metadata.get('x-api-key'), ['local-fixture-key'])
      assert.ok(call.request.readMask.paths.includes('owner'))
      assert.ok(Number.isFinite(+call.getDeadline()))
      if (failCode) return callback({ code: failCode, message: 'fixture failure' })
      callback(null, { object: { objectId: call.request.objectId, version: 9007199254740993n, digest: 'fixture-digest', objectType: 'fixture-type' } })
    },
    getCheckpoint: (call, callback) => {
      assert.deepEqual(call.metadata.get('x-api-key'), ['local-fixture-key'])
      callback(null, { checkpoint: GrpcTypes.Checkpoint.create({ sequenceNumber: 9007199254740994n, digest: 'checkpoint-fixture' }) })
    }
  })
  const port = await new Promise((resolve, reject) => server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (err, port) => err ? reject(err) : resolve(port)))
  const options = { transportFactory: () => new GrpcTransport({ host: `127.0.0.1:${port}`, channelCredentials: ChannelCredentials.createInsecure() }) }
  try {
    const result = await readTatumSuiObject('0x1234', options)
    assert.equal(result.object.objectId, '0x1234')
    assert.equal(result.object.version, '9007199254740993')
    const checkpoint = await readTatumSuiCheckpoint(options)
    assert.equal(checkpoint.checkpoint.sequenceNumber, '9007199254740994')
    failCode = status.UNAUTHENTICATED
    await assert.rejects(readTatumSuiObject('0x1234', options), err => tatumSuiError(err).status === 'tatum_auth_error')
    failCode = status.NOT_FOUND
    await assert.rejects(readTatumSuiObject('0x1234', options), err => tatumSuiError(err).status === 'object_not_found')
    const before = calls
    await assert.rejects(readTatumSuiObject('not-a-sui-object', options), err => tatumSuiError(err).httpStatus === 400)
    assert.equal(calls, before)
  } finally {
    server.forceShutdown()
    if (originalKey === undefined) delete process.env.TATUM_API_KEY
    else process.env.TATUM_API_KEY = originalKey
  }
})
