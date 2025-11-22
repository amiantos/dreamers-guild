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
- **PIN Protection**: Optional PIN-based security for the application
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

2. **Configure environment variables:**

   Create a `.env` file in the root directory:
   ```env
   HORDE_API_KEY=your_api_key_here
   PORT=8005
   ```

   Get your API key from [AI Horde](https://aihorde.net/register) (free registration).

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

   This starts both backend and frontend concurrently:
   - Backend: http://localhost:8005
   - Frontend: http://localhost:5178

   The frontend proxies API requests to the backend automatically.

### Available Scripts

- `npm run dev` - Run both backend and frontend in development mode
- `npm run server:dev` - Run only the backend with auto-reload
- `npm run client:dev` - Run only the frontend dev server
- `npm run client:build` - Build frontend for production
- `npm run install:all` - Install dependencies for both backend and frontend

## Production Deployment

### Docker (Recommended)

1. **Create a `.env` file** with your configuration:
   ```env
   HORDE_API_KEY=your_api_key_here
   PORT=8005
   ```

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

   The application will be available at http://localhost:8005

3. **Data persistence:**
   - Images and database are stored in `./data` directory
   - This directory is mounted as a volume for persistence

### Manual Deployment

1. Build the frontend:
   ```bash
   npm run client:build
   ```

2. Set environment variables:
   ```bash
   export NODE_ENV=production
   export HORDE_API_KEY=your_api_key_here
   export PORT=8005
   ```

3. Start the server:
   ```bash
   npm run server
   ```

   The server will serve both the API and the built frontend.

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

MPL2.0

## Acknowledgments

- [AI Horde](https://aihorde.net/) - Decentralized AI image generation network
- [CivitAI](https://civitai.com/) - LoRA model repository
- [AI Horde Styles](https://github.com/Haidra-Org/AI-Horde-Styles) - Community-contributed generation styles

