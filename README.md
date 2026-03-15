# openclaw-model-dashboard

A lightweight static dashboard for monitoring AI model usage, managing providers, and configuring fallback chains in OpenClaw gateway.

## Features

- **Usage Stats** — token consumption per model across day / week / month, visualized as bar charts
- **Model Catalog** — all configured providers and models with last-call status, filter by active / error / reasoning / vision
- **Fallback Chain Editor** — drag-and-drop to reorder fallback models, save with one click (auto-restarts gateway)
- **Set Primary Model** — click any model card to set it as the default
- **i18n** — Chinese / English toggle
- **No backend required** — single-file HTML + static JSON, served by nginx

## Architecture

```
cron (every 15 min)
  └─ scripts/models-usage-export.mjs
       ├─ scans ~/.openclaw/agents/main/sessions/*.jsonl
       ├─ reads openclaw.json (providers + agent defaults)
       └─ writes /var/www/html/models-usage/data.json

nginx (static)
  └─ serves index.html + data.json

scripts/models-save-api.mjs  (port 8789, systemd user service)
  ├─ POST /api/set-primary    → writes openclaw.json, restarts gateway
  └─ POST /api/save-fallbacks → writes openclaw.json, restarts gateway
```

## Files

| Path | Description |
|------|-------------|
| `index.html` | Single-file SPA dashboard (HTML + CSS + JS, no build step) |
| `scripts/models-usage-export.mjs` | Data export script — run via cron |
| `scripts/models-save-api.mjs` | Lightweight HTTP save API |
| `scripts/deploy-models-manager.sh` | Deploy script |
| `systemd/models-save-api.service` | systemd user service for the save API |

## Setup

### 1. Deploy static files

```bash
bash scripts/deploy-models-manager.sh
```

### 2. Set up cron (data refresh every 15 min)

```bash
crontab -e
# add:
*/15 * * * * /usr/bin/node /path/to/scripts/models-usage-export.mjs
```

### 3. Start save API service

```bash
cp systemd/models-save-api.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now models-save-api
```

### 4. nginx proxy for save API

```nginx
location /models-api/ {
    proxy_pass http://127.0.0.1:8789/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    add_header Cache-Control "no-store";
}
```

## Requirements

- Node.js 18+
- nginx
- [OpenClaw](https://github.com/codyard/openclaw) gateway with session logs at `~/.openclaw/agents/main/sessions/`
