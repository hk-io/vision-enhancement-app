# Vision Enhancement App

This repository contains the implementation of a thesis prototype for low-vision assistance.  
The system integrates real-time camera enhancement, text support workflows, and scene description in a browser-based application.

## System Description

The application provides four primary functions:

- **Contrast Enhancement:** adaptive real-time enhancement of the camera feed.
- **Smart Text AR:** freeze-frame OCR overlays for detected text regions.
- **Smart Read:** full-screen document-style OCR reading with search and speech support.
- **Smart Scene:** natural-language scene description from a captured image.

## Computational Architecture

- **On-device processing (browser):**
  - OpenCV.js enhancement pipeline
  - Tesseract.js OCR for Smart Read
  - TensorFlow.js + Transformers.js inference for Smart Scene
- **Server-side processing:**
  - Google Cloud Vision OCR for Smart Text AR

## Technical Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Vision and OCR:** OpenCV.js, Tesseract.js, TensorFlow.js, COCO-SSD, Transformers.js
- **Backend/API:** Node.js, Express, tRPC
- **External service:** Google Cloud Vision API (server-integrated)

## Reproducibility

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

Environment variables are required for server-side OCR services and should be configured locally or in deployment environments.

## License

MIT
