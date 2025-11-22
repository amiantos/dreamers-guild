# Aislingeach Web

A locally-run web application for generating AI images using the AI Horde network.

## Features

### Image Generation
- Submit image generation requests to AI Horde with full control over generation parameters
- **Styles System**: Browse and apply pre-configured generation styles with preview images
  - Visual grid layout with person/place/thing preview images
  - Favorite styles for quick access
  - Template-based prompts with automatic parameter application
- **LoRAs Support**: Search and apply LoRAs from CivitAI
  - Browse trending and popular LoRAs
  - Search by name, description, or tags
  - View model previews and details
  - Server-side caching for faster loading
- **Model Selection**: Choose from available AI Horde models
- **Advanced Controls**: Fine-tune generation with parameters like:
  - Steps, CFG scale, sampler selection
  - Image dimensions, Karras noise, tiling
  - HiRes fix, CLIP skip, post-processing
  - Worker preferences (slow/trusted workers, NSFW)

### Library & Organization
- **Image Library**: Browse all generated images in a grid view
- **Search & Filter**: Find images by keywords, request, or favorites
- **Albums**: Automatic keyword extraction creates browsable albums
- **Favorites**: Star images to filter and find them later
- **Request History**: Track ongoing and completed requests with status updates

### Settings & Security
- **Hidden Images**: Hide sensitive images from the main library
- **PIN Protection**: Optional 4-digit PIN to protect access to hidden images
- **API Key Management**: Configure your AI Horde API key directly in the app settings
- **Light/Dark Mode**: Toggle between theme preferences
- **Persistent Settings**: Save generation preferences and UI state

### Processing
- Sequential request processing to avoid overwhelming Horde servers
- Real-time status updates for pending requests
- Automatic retry handling for failed requests

## Tech Stack

- **Backend**: Node.js with Express.js
  - SQLite database for metadata and settings
  - Sharp for image processing
  - Axios for AI Horde and CivitAI API integration
- **Frontend**: Vue 3 with Vite
  - Component-based architecture
  - Reactive state management
  - Font Awesome icons
- **Storage**:
  - File system for generated images
  - SQLite for metadata, settings, and request history
  - Server-side caching for LoRA data

## Development

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Setup

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Run in development mode:**
   ```bash
   npm run dev
   ```

   This starts both backend and frontend concurrently:
   - Backend: http://localhost:8005
   - Frontend: http://localhost:5178

   The frontend proxies API requests to the backend automatically.

3. **Configure your API key:**

   Once the application is running, navigate to Settings and enter your AI Horde API key.
   Get your API key from [AI Horde](https://aihorde.net/register) (free registration).

### Available Scripts

- `npm run dev` - Run both backend and frontend in development mode
- `npm run server:dev` - Run only the backend with auto-reload
- `npm run client:dev` - Run only the frontend dev server
- `npm run client:build` - Build frontend for production
- `npm run install:all` - Install dependencies for both backend and frontend

## Production Deployment

### Docker (Recommended)

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

   The application will be available at http://localhost:8005

2. **Configure your API key:**

   Navigate to Settings in the web interface and enter your AI Horde API key.

3. **Data persistence:**
   - Images and database are stored in `./data` directory
   - This directory is mounted as a volume for persistence
   - Your API key and settings are saved in the database

### Manual Deployment

1. **Build the frontend:**
   ```bash
   npm run client:build
   ```

2. **Set environment variables (optional):**
   ```bash
   export NODE_ENV=production
   export PORT=8005  # Optional, defaults to 8005
   ```

3. **Start the server:**
   ```bash
   npm run server
   ```

   The server will serve both the API and the built frontend at http://localhost:8005

4. **Configure your API key:**

   Navigate to Settings in the web interface and enter your AI Horde API key.

## Project Structure

```
aislingeach-web/
├── server/                    # Express backend
│   ├── db/                   # Database setup and models
│   │   └── database.js       # SQLite database initialization
│   ├── routes/               # API endpoints
│   │   ├── requests.js       # Image generation requests
│   │   ├── images.js         # Image metadata and retrieval
│   │   ├── styles.js         # Generation styles
│   │   ├── albums.js         # Keyword-based albums
│   │   ├── civitai.js        # CivitAI API proxy
│   │   ├── loraCache.js      # LoRA caching
│   │   └── settings.js       # User settings
│   ├── services/             # Business logic
│   │   ├── hordeService.js   # AI Horde API integration
│   │   └── queueManager.js   # Request queue processing
│   └── server.js             # Application entry point
├── vue_client/               # Vue 3 frontend
│   ├── src/
│   │   ├── components/       # Reusable Vue components
│   │   │   ├── RequestGeneratorModal.vue
│   │   │   ├── StylePicker.vue
│   │   │   ├── LoraPicker.vue
│   │   │   ├── ModelPicker.vue
│   │   │   ├── ImageModal.vue
│   │   │   └── ...
│   │   ├── views/            # Main view components
│   │   │   ├── LibraryView.vue
│   │   │   └── SettingsView.vue
│   │   ├── services/         # Frontend services
│   │   └── App.vue           # Root component
│   └── package.json
├── data/                     # Persistent storage (created at runtime)
│   ├── images/              # Generated images
│   └── aislingeach.db       # SQLite database
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## License

This project is licensed under the Mozilla Public License 2.0 - see the [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/) for details.

## Acknowledgments

- [AI Horde](https://aihorde.net/) - Decentralized AI image generation network
- [CivitAI](https://civitai.com/) - LoRA model repository
- [AI Horde Styles](https://github.com/Haidra-Org/AI-Horde-Styles) - Community-contributed generation styles

