# SwimMemo: Tatum Sui gRPC update

This update replaces the retired JSON-RPC inspector with Tatum's supported native gRPC gateway. It reuses your existing TATUM_API_KEY. Do not alter MEMWAL_ACCOUNT_ID, MEMWAL_PRIVATE_KEY, MEMWAL_SERVER_URL or OWNER_SECRET.

1. Extract swimmemo-grpc-update.zip.
2. Open the swimmemo-grpc-update folder. Upload its CONTENTS to the root of generalrico/swimmemo using GitHub Add file > Upload files. Preserve the server/, src/ and tests/ folder paths. Replace matching files; do not create a nested swimmemo-grpc-update folder in the repository.
3. Commit to main.
4. Wait for Render to deploy the new commit. If auto-deploy is disabled, use Manual Deploy > Deploy latest commit. Keep the same build/start commands and environment values.
5. Refresh https://swimmemo.onrender.com, enter the owner token if required, then open Profile & Secrets Setup > Inspect MEMWAL_ACCOUNT_ID.
6. A successful response should include status: success, protocol: grpc, the Tatum gateway endpoint, and an object containing objectId, version and type data. An authentication, object-not-found or gateway error remains a failure and is reported separately.

Files: package.json, package-lock.json, server/tatum-sui.mjs, server/routes/memwal.mjs, server/routes/tatum.mjs, src/App.tsx, tests/tatum-sui.test.mjs and this guide.

The server uses SuiGrpcClient plus the native @protobuf-ts/grpc-transport transport over TLS to sui-mainnet-grpc.gateway.tatum.io:443. The key is metadata named x-api-key. No key values are included in this archive. No real blockchain transactions were executed.

Validation: TypeScript check, production build, existing owner/memory tests and a local native gRPC protocol test passed. Tests verify key metadata, GetObject/GetCheckpoint messages, lossless large integer serialization, error classification and invalid-ID rejection. Live Tatum access remains unverified pending deployment.

References:
https://docs.tatum.io/docs/sui-migration-guide-from-json-rpc-to-grpc
https://docs.tatum.io/reference/sui-grpc
https://sdk.mystenlabs.com/sui/clients/grpc
