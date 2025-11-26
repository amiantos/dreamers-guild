export { requestsApi, resumePolling } from './requests.js'
export { imagesApi, resolveBlobUrl, revokeBlobUrl, revokeAllBlobUrls } from './images.js'
export { settingsApi } from './settings.js'
export { stylesApi } from './styles.js'
export { albumsApi } from './albums.js'

export { openDatabase, clearAllStores, getStorageEstimate } from './db.js'
export {
  getHordeUser,
  getHordeWorkers,
  getHordeModels,
  getHordeStyles
} from './horde.js'

import { resumePolling } from './requests.js'

export function initDemoMode() {
  console.log('[Demo Mode] Initializing...')
  resumePolling()
  console.log('[Demo Mode] Ready')
}
