# AVA Voice Receptionist Dashboard

Full-stack dashboard for **AVA**, the AI phone receptionist for TabSphere Limited
(Twilio Voice + OpenAI + ElevenLabs), with a React admin UI for monitoring calls,
managing leads, and configuring every integration from the browser.

## Stack

- **Backend** — Node 20 + Express (ESM), Twilio voice webhooks, JSON-file store (`data/db.json`), config with precedence `data/config.json` > env vars > defaults.
- **Frontend** — Vite + React 19 + Tailwind CSS v3.4, Plus Jakarta Sans, charcoal/slate + amber.

## Quick start

```bash
npm install
npm --prefix client install
npm run dev        # server on :3001 + Vite dev server on :5173 (proxy /api /voice /audio)
```

Production:

```bash
npm run build      # builds client → client/dist
npm start          # serves API + built client on PORT (default 3001)
```

Docker:

```bash
docker build -t ava-dashboard .
docker run -p 3001:3001 -v $(pwd)/data:/app/data ava-dashboard
```

## Setup walkthrough

1. **Open the dashboard → Settings.** Add your keys per group and press **Save**:
   - **Twilio** — Account SID, Auth Token, phone number, WhatsApp sender (`whatsapp:+14155238886` is the Twilio sandbox).
   - **OpenAI** — API key, model (`gpt-4o-mini` default).
   - **ElevenLabs** — API key + **Voice ID** (find it in ElevenLabs VoiceLab → click a voice → "ID"). Without these, AVA falls back to Twilio's Polly Amy voice automatically.
   - **Notifications** — Frederick's WhatsApp (prefilled `+447593836195`), escalation forward number, optional SMTP for email summaries.
   - **Server** — `PUBLIC_URL` (your public domain or ngrok URL — required for ElevenLabs audio `<Play>` URLs and the webhook).
2. **Press "Test connection"** on each group (OpenAI lists models, ElevenLabs lists voices, Twilio fetches the account). The WhatsApp test returns sandbox instructions.
3. **Deploy** so the server is reachable publicly (or run `ngrok http 3001`).
4. **Copy the webhook URL** from the prominent card at the top of Settings (`{PUBLIC_URL}/voice`) and paste it in the Twilio console:
   Phone Numbers → your number → Voice Configuration → "A call comes in" → Webhook, HTTP POST.

### WhatsApp sandbox note

Until your sender is approved, Frederick must join the Twilio WhatsApp sandbox once:
from his phone, send `join <sandbox-code>` to the sandbox number
(Twilio Console → Messaging → Try it out → Send a WhatsApp message shows the code).
After that, every lead summary and voicemail lands in his WhatsApp.

## How calls flow

- `POST /voice` — greeting (after-hours aware, Europe/London, Mon–Sat 9–18) + speech gather.
- `POST /gather` — OpenAI reply; `[ESCALATE]` token → `<Dial>` to Frederick; silence → 2 reprompts → voicemail.
- `POST /dial-complete` — no answer → voicemail.
- `POST /voicemail` — recording transcribed (Whisper) → WhatsApp notification.
- `POST /status` — call end → lead extracted from transcript → stored + WhatsApp/email notification.

All calls, transcripts and leads are visible in the **Calls** and **Leads** pages.

## Security

- Secrets are never returned by the API — Settings shows masked values (`sk-...abcd`); partial saves never wipe stored secrets.
- Set `TWILIO_VALIDATE_SIGNATURE=true` in production to validate Twilio webhook signatures.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Server (:3001) + Vite client (:5173) with proxy |
| `npm run build` | Build the client |
| `npm start` | Production server serving API + client |
| `npm test` | Smoke tests (no external API calls) |
