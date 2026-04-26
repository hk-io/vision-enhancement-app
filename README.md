# Vision Enhancement App

Thesis project: a web-based vision assistance system for low-vision support.  
The app combines real-time image enhancement, AR text support, document OCR reading, and scene description in a single browser-based workflow.

## Key Features

- **Contrast enhancement (live):** OpenCV.js-based local contrast and edge enhancement with adaptive bright/dim/dark processing.
- **Smart Text AR:** Freeze-frame text detection with high-contrast overlay labels.
- **Smart Read:** Full-screen OCR reading mode with search, read-aloud, and sentence/word highlighting.
- **Smart Scene:** Natural-language scene description with on-device vision models and speech playback.
- **Upload mode:** Same enhancement controls for still images, plus optional low-light boost toggle.

## Architecture Overview

- **On-device (browser):**
  - Contrast enhancement (OpenCV.js)
  - Smart Read OCR (Tesseract.js)
  - Smart Scene inference (TensorFlow.js + Transformers.js)
- **Server-assisted:**
  - Smart Text AR OCR (Google Cloud Vision via backend API)

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Computer vision: OpenCV.js, TensorFlow.js, COCO-SSD, Transformers.js, Tesseract.js
- Backend: Node.js, Express, tRPC
- OCR API: Google Cloud Vision (server-side integration)

## Local Development

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment

Create `.env` in project root and add required keys (example names):

```env
GOOGLE_CLOUD_VISION_API_KEY=your_key_here
OAUTH_SERVER_URL=your_oauth_url_here
```

Notes:
- Do not commit `.env`.
- Keep API keys server-side only.

### 3) Start development server

```bash
pnpm dev
```

The app runs with HTTPS in development to support camera access on modern browsers.

## Quality Checks

```bash
pnpm check
pnpm build
pnpm test
```

## Deployment Notes

- Frontend can be deployed to static hosting (for example Netlify).
- Backend API must be deployed separately (for example Render/Railway/Fly) for Smart Text AR OCR.
- Set production env vars on the backend host; never expose private keys in frontend env variables.

## Repository Safety

- `.env*` files are ignored by `.gitignore`.
- No secrets should be hardcoded in tracked source files.

## License

MIT (or update to your preferred license in GitHub repository settings).
