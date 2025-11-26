# Dreamers Guild

A self-hosted web app for generating AI images using the [AI Horde](https://aihorde.net/) network.

## Features

- Generate images with full control over models, samplers, and parameters
- Apply pre-configured styles and LoRAs from CivitAI
- Organize your library with favorites, albums, and hidden images
- PIN protection for sensitive content
- Light/dark theme support

## Quick Start

### Docker (Recommended)

```bash
docker-compose up -d
```

Open http://localhost:8005 and configure your AI Horde API key in Settings.

### Manual Setup

```bash
npm run install:all
npm run dev
```

- Backend: http://localhost:8005
- Frontend: http://localhost:5178

Get your free API key at [aihorde.net/register](https://aihorde.net/register).

## Production

Build and run:

```bash
npm run client:build
NODE_ENV=production npm run server
```

Data is stored in `./data/` (images and SQLite database).

## License

[MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/)

## Acknowledgments

- [AI Horde](https://aihorde.net/) - Decentralized AI image generation
- [CivitAI](https://civitai.com/) - LoRA repository
- [AI Horde Styles](https://github.com/Haidra-Org/AI-Horde-Styles) - Generation styles
