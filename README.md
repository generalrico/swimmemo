# SwimMemo 🏊

A swimming training companion that remembers previous sessions and uses recalled information to explain its next workout suggestion.

**Live demo:** https://swimmemo.onrender.com  
**Hackathon:** Total Recall — Walrus × Tatum  
**Track:** Smart Agents for Real Life

## The Problem

Training advice becomes less useful when it ignores previous sessions, technique difficulties and swimmer feedback. SwimMemo explores how persistent memory can make training suggestions more consistent and understandable.

## What SwimMemo Does

- Creates an editable swimmer profile with training goals.
- Records sessions, effort ratings, technique notes and feedback.
- Lets swimmers review and approve memories before uploading.
- Stores approved memories on Walrus mainnet.
- Retrieves relevant memories through the official Walrus Memory SDK.
- Uses recalled information in rule-based workout recommendations.
- Explains which memory influenced a suggestion and displays its blob ID.
- Inspects the Walrus Memory account on Sui through Tatum’s gRPC gateway.

## Demonstrated Memory Loop

1. Save a swimmer-approved memory describing fatigue after freestyle.
2. Wait for the background job to complete and return a blob ID.
3. Recall the memory using a relevant query.
4. View the Dashboard’s lower-intensity recovery suggestion.
5. Inspect the explanation linking that suggestion to the recalled memory.

Ten distinct memories were saved and recalled during testing. Fictional testing records are labelled “Demo scenario.”

Recommendations use programmed rules informed by retrieved memories. SwimMemo does not train or fine-tune an AI model.

## Technology

- React, TypeScript and Tailwind CSS
- Node.js, Express and Vite
- Official `@mysten-incubation/memwal` SDK
- `@mysten/sui` with native gRPC transport
- Tatum Sui mainnet gRPC gateway
- Render hosting

The initial app was generated with Tatum AI Builder, then exported to GitHub and updated for production hosting and Sui gRPC support.

## Walrus Memory Integration

The server uses a dedicated `swimmemo_v1` namespace.

- `remember()` submits an approved memory.
- `getRememberStatus()` tracks the asynchronous write.
- A completed job with a blob ID is counted as confirmed.
- `recall()` retrieves relevant memories for display and recommendations.

Local training records are kept separate from confirmed Walrus memories.

## Tatum Integration

The server queries:

`https://sui-mainnet-grpc.gateway.tatum.io:443`

The account inspector uses `LedgerService.GetObject` with the configured Walrus Memory account object ID. The Tatum API key is supplied server-side as `x-api-key` metadata.

Walrus blob IDs and Sui object IDs are different identifiers.

## Run Locally

Use Node.js 22 or 24.

```bash
git clone https://github.com/generalrico/swimmemo.git
cd swimmemo
npm ci --include=dev
```

Create a local `.env` file using `.env.example` as a template. Supply:

```dotenv
NODE_ENV=production
PORT=3000
MEMWAL_ACCOUNT_ID=YOUR_ACCOUNT_OBJECT_ID
MEMWAL_PRIVATE_KEY=YOUR_DELEGATE_PRIVATE_KEY
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
TATUM_API_KEY=YOUR_MAINNET_API_KEY
OWNER_SECRET=YOUR_LONG_RANDOM_OWNER_PASSWORD
```

These are placeholders. Never commit real credentials.

Build and start:

```bash
npm run build
node --env-file=.env server/index.mjs
```

Open http://localhost:3000.

In Profile & Secrets Setup, enter the same `OWNER_SECRET` as the Owner Token before testing live integrations.

## Deploy

A Render configuration is included in `render.yaml`.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/healthz`

Configure credentials through the hosting platform’s environment settings.

## Validation

```bash
npm run typecheck
npm run build
npm test
```

Automated tests cover owner authorization, explicit memory approval, credential redaction, job confirmation and native gRPC requests against a local test server.

Live testing verified memory writes, recall, memory-influenced recommendations and Tatum account inspection.

## Current Limitations

- Single-owner demonstration, rather than a multi-user service.
- Live server APIs require an owner token; the public interface can be viewed without it.
- Profiles, training logs and feedback are browser-local.
- Job receipts use browser storage and an ephemeral server cache.
- The displayed confirmation count is not a complete remote-memory inventory.
- Recalled memories must be retrieved again after a page reload.
- Recommendations use a limited set of rules; not every saved preference changes the workout.
- Some interface labels still contain wording inherited from the original builder preview.

## Author

Alimi Olanrewaju Abdulhameed  
Swimmer and swimming instructor, University of Ibadan.
