# Vision Enhancement App

A web-based multimodal visual augmentation prototype for low-vision users. It combines real-time contrast enhancement, AR text overlay, OCR with audio output, and AI-assisted scene description in a single zero-installation browser interface.

This repository accompanies the Master's thesis:
**Khatab, H. (2026). Visual Augmentation and Multimodal Assistive Technology for People with Low Vision: A Literature-Driven Design Study. Tampere University / Tallinn University / Lusofona University.**

## Submission state

The state of this repository at thesis submission is preserved as the git tag `thesis-submission-v1`.
To view that exact state:

```bash
git checkout thesis-submission-v1
```

## Key dependencies

Pinned versions are in `package.json` and the lockfile. Submission-state versions:

- `opencv-js-wasm` `5.0.0-alpha` - CLAHE via WebAssembly-compiled OpenCV
- `@tensorflow/tfjs` `4.22.0` + `@tensorflow/tfjs-backend-webgl` `4.22.0` - TensorFlow.js runtime for Zero-DCE++ inference
- `@tensorflow-models/coco-ssd` `2.2.3` - pre-trained object detection
- `@xenova/transformers` `2.17.2` - Transformers.js loading SmolVLM-256M-Instruct
- `tesseract.js` `7.0.0` - on-device OCR with LSTM engine

## Installation and running

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Repository structure

```text
client/                 Frontend source code (React + TypeScript)
server/                 Backend and API routes (Express + tRPC)
shared/                 Shared types and utilities
drizzle/                Database schema and migration config
patches/                Package patches applied by pnpm
public/                 Static assets
```

## License

MIT License - see `LICENSE`.

## Citing this work

If you use this code, please cite:

> Khatab, H. (2026). Visual Augmentation and Multimodal Assistive Technology for People with Low Vision: A Literature-Driven Design Study. Master's thesis, Tampere University / Tallinn University / Lusofona University.

A `CITATION.cff` file is included for citation tooling.
