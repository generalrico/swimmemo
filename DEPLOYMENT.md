# Deploy SwimMemo

This is a single-owner hackathon demo. The public page can be viewed, but live memory and Tatum API routes require your owner token. Do not give that token to public visitors. This is not a multi-user account system.

## 1. Update your existing GitHub repository

Extract this archive. Upload the CONTENTS of swimmemo-main to the root of generalrico/swimmemo, replacing the existing files (do not upload the parent folder itself). Keep your repository private while testing. No real credentials are included. Stop editing/syncing the old Tatum project after this update, because a later sync could overwrite these fixes.

Changed/new files: package.json, package-lock.json, server/index.mjs, server/owner-auth.mjs, server/routes/memwal.mjs, server/routes/tatum.mjs, src/App.tsx, render.yaml, .node-version, .env.example, .gitignore, tests/server.test.mjs and this guide.

## 2. Create a Render Web Service

Open https://dashboard.render.com and connect your GitHub repository using New > Web Service. Select Node, your main branch and the repository root.

- Build command: npm ci --include=dev && npm run build
- Start command: npm start
- Instance: select Free if offered; review the plan before creating the service.
- Health-check path: /healthz
- NODE_ENV: production

Alternatively create a Blueprint from the included render.yaml. It requests the free service plan and prompts for your credentials. No service has been created by this archive.

## 3. Configure server environment variables on Render

MEMWAL_PRIVATE_KEY: delegate private key from Walrus SDK credentials.
MEMWAL_ACCOUNT_ID: account object ID from the same page, not the wallet address at the top.
MEMWAL_SERVER_URL: https://relayer.memory.walrus.xyz
TATUM_API_KEY: existing Tatum mainnet key.
OWNER_SECRET: generate your own long random password (at least 32 random characters) in a password manager and keep it private.

Do not paste these into builder chat, source files, GitHub issues, or screenshots. Render supplies PORT. The .env.example file is a blank reference only, not a file to fill in and upload. Standard environment variables work outside Tatum without /creds/creds.json.

## 4. Test on the deployed URL

1. Open Profile & Secrets Setup and enter only your OWNER_SECRET in Owner Token. The browser stores this demo token locally; use your own computer and clear it on a shared machine. Never put the Walrus private key in this field.
2. Test Health. The server first checks reachability, then makes a signed recall request to verify access. An empty recall is valid for a new account.
3. Inspect MEMWAL_ACCOUNT_ID to verify the configured object through Tatum's Sui mainnet RPC.
4. In Memory Vault, manually save ONE non-sensitive training memory with explicit approval. Wait for a completed job with a blob ID, then recall a matching phrase.
5. Reload and confirm the memory can be recalled again.
6. Only after that succeeds, approve and save at least ten meaningful memories for the hackathon. Confirm writes individually. No test in this archive writes to mainnet.
7. Show recalled memories changing a recommendation. Complete the blog post, public code repository and demo video before submission.

## Validation and limits

TypeScript and production build checks passed. Automated server tests cover the owner gate, signed-authentication failure reporting, strict upload approval, credential redaction and receipt confirmation using a fake SDK. A local production HTTP smoke check verifies static pages and API routing. Real Tatum/Walrus authentication and writes require your deployment credentials and remain unverified.

The installed SDK's remember(text, options) overload is valid and was retained. The old generic Tatum storage upload route is disabled to avoid bypassing approved memory writes. Training data stays browser-local unless explicitly saved to Walrus Memory. The app uses a single swimmemo_v1 namespace for its single owner.

Job receipts are kept in browser storage and an ephemeral server cache. Browser data clearing loses local receipt counts; stored Walrus memories remain independently recallable. Account changes should use a fresh browser profile. Do not interpret the displayed receipt count as an authoritative inventory of every remote memory. Multi-device receipt synchronization is not implemented.

Render documentation: https://render.com/docs/deploy-node-express-app
Walrus SDK: https://docs.wal.app/walrus-memory/sdk/api-reference
