# AutoVideo Bot — Project Rules

## Quick Reference
| Item | Value |
|---|---|
| Local code | `D:\work\autovideo-bot` |
| Server path | `/home/ubuntu/autovideo-bot/backend/` |
| PM2 process | `youtube-bot` (id 4) |
| Admin URL | `https://youtube.newsbuzz.site/admin` |
| Admin password | `Admin@123` |
| API base | `http://localhost:5007/api/admin` |
| Git branch | `optimization5` |

## API Key Management
- Keys are stored in MongoDB, managed via admin API
- Add keys: `POST /api/admin/keys` with `{"provider":"groq","key":"...","label":"..."}`
- Header required: `x-admin-key: Admin@123`
- Providers: `groq`, `openrouter`, `gemini`, `newsapi`, `pexels`, `youtube`, `jamendo`, `rapidapi`, `serper`
- **Never** put API keys in `.env` on the server — always use the admin API

## Gemini Model Deprecation (Sep 2026)
- **BROKEN (404):** `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.0-flash-lite`
- **WORKING:** `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`
- Always verify model IDs against live Google API before assuming a key is broken

## Vision Gate Model Rotation
- Vision gate file: `backend/services/visionQualityGate.js`
- Free OpenRouter vision models go down frequently
- When vision gate fails, search OpenRouter for current free vision-capable models
- Current working (Sep 2026): `inclusionai/ling-3.0-flash-vl:free`, `thinkingmachines/inkling:free`
- Vision gate is ADVISORY_ONLY (doesn't block pipeline) — content filter via BLOCK_KEYWORDS is primary defense

## VPS Video Tools (No AI Required)
- `ffprobe/ffmpeg 6.1.1` — video metadata + processing (pure binary parsing)
- `OpenCV 5.0` — sharpness + motion detection (pixel math)
- `yt-dlp` — video download + metadata scraping
- `Pillow`, `imagehash`, `scikit-image`, `moviepy` — image processing + duplicate detection
- `clip_quality.py` — combines all above into 0-100 quality score
- Only the Vision Gate uses AI (OpenRouter free vision models)
