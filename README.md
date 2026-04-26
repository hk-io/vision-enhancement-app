# Vision Enhancement App

Web-based vision assistance app with real-time contrast enhancement, Smart Text AR, Smart Read OCR, and Smart Scene description.

## Features

- Real-time contrast and edge enhancement for camera feed
- Smart Text AR using server OCR overlays on frozen frames
- Smart Read full-screen OCR reader with search and read-aloud
- Smart Scene image description with on-device vision models
- Upload flow with optional low-light enhancement toggle

## Tech Stack

- React + TypeScript + Vite
- OpenCV.js (image enhancement)
- Tesseract.js (Smart Read OCR)
- TensorFlow.js + COCO-SSD + Transformers.js (Smart Scene)
- Node.js + Express + tRPC (API)
- Google Cloud Vision API (Smart Text AR OCR)

## Run Locally

```bash
pnpm install
pnpm dev
```

App runs on HTTPS in development (for camera access).

## Build

```bash
pnpm check
pnpm build
```

## Notes

- Keep secrets in `.env` files only (not in source code).
- Smart Text AR requires backend API and Google Vision credentials.
