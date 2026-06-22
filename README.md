# ALIGNA11 v2

Sacred numerology app. Single-file frontend (`public/index.html`) on Cloudflare Pages.
All `/api/*` calls proxy to the Cloudflare engine worker `aligna11-engine` (the brain:
AI, voice, streaming, GHL registration — fast free models).

## Deploy
- Frontend: Cloudflare Pages project `aligna11-v2` (publish dir: `public`, functions: `functions/`)
- Engine: worker `aligna11-engine` (separate; holds the API keys as secrets)

## v1 history
Live selling app: aligna11.netlify.app (untouched). This v2 completes the Cloudflare migration.
