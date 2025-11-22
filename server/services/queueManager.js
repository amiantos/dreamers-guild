import hordeApi from './hordeApi.js';
import { HordeRequest, GeneratedImage, HordePendingDownload } from '../db/models.js';
import { imagesDir } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Queue Manager - Handles sequential processing of AI Horde requests
 * Based on the iOS GenerationTracker implementation
 */
class QueueManager {
  constructor() {
    this.maxActiveRequests = 5;
    this.activeRequests = new Map(); // requestId -> hordeRequestId
    this.activeDownloads = new Set(); // downloadId -> prevent duplicate processing
    this.isProcessing = false;
    this.isSubmitting = false; // Prevent concurrent submissions
    this.isDownloading = false; // Prevent concurrent downloads
    this.statusCheckInterval = null;
    this.downloadCheckInterval = null;
  }

  /**
   * Start the queue manager
   */
  start() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('Queue Manager started');

    // Recover any processing requests from database (in case of server restart)
    this.recoverProcessingRequests();

    // Check for pending requests every 3 seconds
    this.statusCheckInterval = setInterval(() => {
      this.processQueue();
    }, 3000);

    // Check for pending downloads every 2 seconds
    this.downloadCheckInterval = setInterval(() => {
      this.processDownloads();
    }, 2000);

    // Initial run
    this.processQueue();
  }

  /**
   * Recover processing requests after server restart
   */
  recoverProcessingRequests() {
    try {
      const allProcessing = HordeRequest.findPending()
        .filter(req => req.status === 'processing' || req.status === 'waiting');

      // Separate into recoverable (with horde_id) and orphaned (without horde_id)
      const recoverable = allProcessing.filter(req => req.horde_id);
      const orphaned = allProcessing.filter(req => !req.horde_id);

      if (recoverable.length > 0) {
        console.log(`[Recovery] Found ${recoverable.length} processing requests to recover`);

        recoverable.forEach(req => {
          // Re-add to active requests Map
          this.activeRequests.set(req.uuid, req.horde_id);
          console.log(`[Recovery] ✓ Recovered request ${req.uuid.substring(0, 8)}... (Horde ID: ${req.horde_id})`);
        });
      } else {
        console.log('[Recovery] No processing requests to recover');
      }

      // Handle orphaned requests (no horde_id - can't track them)
      if (orphaned.length > 0) {
        console.log(`[Recovery] Found ${orphaned.length} orphaned processing requests (no Horde ID)`);

        orphaned.forEach(req => {
          console.log(`[Recovery] ✗ Marking orphaned request ${req.uuid.substring(0, 8)}... as failed`);
          HordeRequest.update(req.uuid, {
            status: 'failed',
            message: 'Lost tracking after server restart (no Horde ID saved)'
          });
        });
      }
    } catch (error) {
      console.error('[Recovery] Error recovering processing requests:', error);
    }
  }

  /**
   * Stop the queue manager
   */
  stop() {
    this.isProcessing = false;
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    if (this.downloadCheckInterval) {
      clearInterval(this.downloadCheckInterval);
      this.downloadCheckInterval = null;
    }
    console.log('Queue Manager stopped');
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    try {
      console.log(`[Queue] Processing queue - Active: ${this.activeRequests.size}/${this.maxActiveRequests}`);

      // Submit new requests if we have capacity
      if (this.activeRequests.size < this.maxActiveRequests) {
        await this.submitPendingRequests();
      }

      // Check status of active requests
      await this.checkActiveRequests();
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  /**
   * Submit pending requests to AI Horde
   */
  async submitPendingRequests() {
    // Prevent concurrent submissions
    if (this.isSubmitting) {
      console.log('[Submit] Already submitting, skipping');
      return;
    }
    this.isSubmitting = true;

    try {
      const availableSlots = this.maxActiveRequests - this.activeRequests.size;
      if (availableSlots <= 0) {
        console.log('[Submit] No available slots');
        return;
      }

      const pendingRequests = HordeRequest.findPending()
        .filter(req => req.status === 'pending' && !this.activeRequests.has(req.uuid))
        .slice(0, availableSlots);

      console.log(`[Submit] Found ${pendingRequests.length} pending requests to submit`);

      for (const request of pendingRequests) {
        try {
          console.log(`[Submit] Submitting request ${request.uuid.substring(0, 8)}...`);

          // Mark as submitting immediately to prevent duplicate submissions
          this.activeRequests.set(request.uuid, 'submitting');

          HordeRequest.update(request.uuid, {
            status: 'submitting',
            message: 'Submitting to AI Horde...'
          });

          const params = JSON.parse(request.full_request);

          // Submit to AI Horde
          console.log(`[Submit] → API call to /generate/async for ${request.uuid.substring(0, 8)}...`);
          const response = await hordeApi.postImageAsyncGenerate(params);
          console.log(`[Submit] ← API response: Horde ID ${response.id}`);

          // Update with actual Horde ID
          this.activeRequests.set(request.uuid, response.id);

          HordeRequest.update(request.uuid, {
            status: 'processing',
            message: `Submitted to AI Horde (ID: ${response.id})`,
            hordeId: response.id
          });

          console.log(`[Submit] ✓ Submitted request ${request.uuid.substring(0, 8)}... to Horde (${response.id})`);
        } catch (error) {
          console.error(`[Submit] ✗ Error submitting request ${request.uuid.substring(0, 8)}...:`, error.message);

          // Remove from active requests on error
          this.activeRequests.delete(request.uuid);

          let errorMessage = 'Failed to submit request';
          if (error.response?.status === 401) {
            errorMessage = 'Invalid API key';
          } else if (error.response?.status === 403) {
            errorMessage = 'Access forbidden';
          }

          HordeRequest.update(request.uuid, {
            status: 'failed',
            message: errorMessage
          });
        }
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Check status of active requests
   */
  async checkActiveRequests() {
    if (this.activeRequests.size === 0) {
      console.log('[Status] No active requests to check');
      return;
    }

    console.log(`[Status] Checking status of ${this.activeRequests.size} active requests`);

    let isFirst = true;
    for (const [requestUuid, hordeId] of this.activeRequests.entries()) {
      // Add 1 second delay between checks (but not before the first one)
      if (!isFirst) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      isFirst = false;

      // Skip requests that are still being submitted
      if (hordeId === 'submitting') {
        console.log(`[Status] Skipping ${requestUuid.substring(0, 8)}... (still submitting)`);
        continue;
      }

      try {
        console.log(`[Status] → API call to /generate/check/${hordeId} for ${requestUuid.substring(0, 8)}...`);
        const status = await hordeApi.getImageAsyncCheck(hordeId);
        console.log(`[Status] ← Response: done=${status.done}, queue_position=${status.queue_position || 0}, wait_time=${status.wait_time || 0}, finished=${status.finished || 0}/${status.processing || 0}`);

        // Update request status
        HordeRequest.update(requestUuid, {
          queuePosition: status.queue_position || 0,
          waitTime: status.wait_time || 0,
          message: status.queue_position > 0
            ? `In queue (position: ${status.queue_position})`
            : 'Processing...'
        });

        // Check if completed
        if (status.done) {
          console.log(`[Status] ✓ Request ${requestUuid.substring(0, 8)}... is DONE, fetching results`);
          // Remove from active requests FIRST to prevent duplicate processing
          this.activeRequests.delete(requestUuid);
          await this.handleCompletedRequest(requestUuid, hordeId);
        } else {
          console.log(`[Status] Request ${requestUuid.substring(0, 8)}... still in progress`);
        }
      } catch (error) {
        if (error.message === 'Request not found') {
          console.log(`[Status] ✗ Request ${hordeId} not found on server, marking as failed`);
          HordeRequest.update(requestUuid, {
            status: 'failed',
            message: 'Request not found on server'
          });
          this.activeRequests.delete(requestUuid);
        } else {
          console.error(`[Status] ✗ Error checking request ${hordeId}:`, error.message);
        }
      }
    }
  }

  /**
   * Handle a completed request
   */
  async handleCompletedRequest(requestUuid, hordeId) {
    try {
      console.log(`[Complete] → API call to /generate/status/${hordeId} for ${requestUuid.substring(0, 8)}...`);
      const statusData = await hordeApi.getImageAsyncStatus(hordeId);
      console.log(`[Complete] ← Response: ${statusData.generations?.length || 0} images generated`);

      if (!statusData.generations || statusData.generations.length === 0) {
        console.log(`[Complete] No images generated for ${requestUuid.substring(0, 8)}...`);
        HordeRequest.update(requestUuid, {
          status: 'completed',
          message: 'No images generated'
        });
        return;
      }

      // Create pending downloads for each image (skip censored images)
      console.log(`[Complete] Processing ${statusData.generations.length} images for ${requestUuid.substring(0, 8)}...`);
      let downloadCount = 0;
      let censoredCount = 0;

      for (const generation of statusData.generations) {
        // Skip censored images
        if (generation.censored === true) {
          censoredCount++;
          console.log(`[Complete]   - Skipping censored image`);
          continue;
        }

        const download = HordePendingDownload.create({
          requestId: requestUuid,
          uri: generation.img,
          fullResponse: JSON.stringify(generation)
        });
        downloadCount++;
        console.log(`[Complete]   - Created download ${download.uuid.substring(0, 8)}... for image: ${generation.img}`);
      }

      if (censoredCount > 0) {
        console.log(`[Complete] Skipped ${censoredCount} censored image(s)`);
      }
      console.log(`[Complete] Created ${downloadCount} pending download(s) for ${requestUuid.substring(0, 8)}...`);

      if (downloadCount === 0) {
        HordeRequest.update(requestUuid, {
          status: 'completed',
          message: censoredCount > 0 ? `All ${censoredCount} images were censored` : 'No images to download'
        });
        console.log(`[Complete] ✓ Request ${requestUuid.substring(0, 8)}... completed with no images to download`);
        return;
      }

      HordeRequest.update(requestUuid, {
        status: 'downloading',
        message: censoredCount > 0
          ? `Downloading ${downloadCount} images (${censoredCount} censored)...`
          : `Downloading ${downloadCount} images...`
      });

      console.log(`[Complete] ✓ Request ${requestUuid.substring(0, 8)}... completed, ${downloadCount} images ready for download`);
    } catch (error) {
      console.error(`[Complete] ✗ Error handling completed request ${requestUuid.substring(0, 8)}...:`, error.message);
      HordeRequest.update(requestUuid, {
        status: 'failed',
        message: 'Error retrieving images'
      });
    }
  }

  /**
   * Process pending downloads
   */
  async processDownloads() {
    // Prevent concurrent download processing
    if (this.isDownloading) {
      console.log('[Download] Already downloading, skipping');
      return;
    }
    this.isDownloading = true;

    try {
      const allPending = HordePendingDownload.findAll();
      const pendingDownloads = allPending.filter(download => !this.activeDownloads.has(download.uuid));

      if (allPending.length === 0) {
        console.log('[Download] No pending downloads');
      } else if (pendingDownloads.length === 0) {
        console.log(`[Download] All ${allPending.length} downloads already being processed`);
      } else {
        console.log(`[Download] Processing ${pendingDownloads.length} pending downloads (${this.activeDownloads.size} already active)`);
      }

      for (const download of pendingDownloads) {
        try {
          console.log(`[Download] Starting download ${download.uuid.substring(0, 8)}... from ${download.uri}`);

          // Mark as being downloaded to prevent duplicates
          this.activeDownloads.add(download.uuid);

          // Delete pending download immediately to prevent duplicate processing
          // (do this before the download in case of errors/crashes)
          HordePendingDownload.delete(download.uuid);

          // Download the image
          console.log(`[Download] → Fetching image data for ${download.uuid.substring(0, 8)}...`);
          const imageData = await hordeApi.downloadImage(download.uri);
          console.log(`[Download] ← Received ${imageData.length} bytes`);

          // Detect image format using sharp
          const metadata = await sharp(imageData).metadata();
          const imageFormat = metadata.format; // e.g., 'png', 'webp', 'jpeg'
          console.log(`[Download] Detected image format: ${imageFormat}`);

          // Generate filename with correct extension
          const imageUuid = uuidv4();
          const imageExtension = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
          const imagePath = path.join(imagesDir, `${imageUuid}.${imageExtension}`);
          const thumbnailPath = path.join(imagesDir, `${imageUuid}_thumb.webp`);

          // Save original image
          console.log(`[Download] Saving image to ${imageUuid}.${imageExtension}`);
          fs.writeFileSync(imagePath, imageData);

          // Generate square thumbnail (512x512) in WEBP format
          console.log(`[Download] Generating thumbnail ${imageUuid}_thumb.webp`);
          await sharp(imageData)
            .resize(512, 512, {
              fit: 'cover',
              position: 'center'
            })
            .webp({ quality: 85 })
            .toFile(thumbnailPath);

          // Get request info for metadata
          const request = HordeRequest.findById(download.request_id);

          // Save to database
          GeneratedImage.create({
            uuid: imageUuid,
            requestId: download.request_id,
            backend: 'AI Horde',
            promptSimple: request?.prompt,
            fullRequest: request?.full_request,
            fullResponse: download.full_response,
            imagePath: `${imageUuid}.${imageExtension}`,
            thumbnailPath: `${imageUuid}_thumb.webp`
          });

          // Remove from active downloads
          this.activeDownloads.delete(download.uuid);

          console.log(`[Download] ✓ Downloaded and saved image ${imageUuid.substring(0, 8)}... (download ${download.uuid.substring(0, 8)}...)`);

          // Check if all downloads for this request are complete
          const remainingDownloads = HordePendingDownload.findAll()
            .filter(d => d.request_id === download.request_id);

          if (remainingDownloads.length === 0) {
            console.log(`[Download] All downloads complete for request ${download.request_id.substring(0, 8)}...`);
            HordeRequest.update(download.request_id, {
              status: 'completed',
              message: 'All images downloaded'
            });
          } else {
            console.log(`[Download] ${remainingDownloads.length} downloads remaining for request ${download.request_id.substring(0, 8)}...`);
          }
        } catch (error) {
          console.error(`[Download] ✗ Error downloading image ${download.uuid.substring(0, 8)}...:`, error.message);
          console.error(`[Download] Image download failed and will not be retried`);
          // Remove from active downloads (note: pending download was already deleted to prevent duplicates)
          this.activeDownloads.delete(download.uuid);
        }
      }
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Add a new request to the queue
   */
  addRequest(requestData) {
    return HordeRequest.create({
      prompt: requestData.prompt,
      fullRequest: JSON.stringify(requestData.params),
      status: 'pending',
      n: requestData.params.params?.n || 1
    });
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      active: this.activeRequests.size,
      maxActive: this.maxActiveRequests,
      isProcessing: this.isProcessing,
      pendingRequests: HordeRequest.findPending().length,
      pendingDownloads: HordePendingDownload.findAll().length
    };
  }

  /**
   * Cancel an active request
   * @param {string} requestId - Local request ID
   * @returns {Promise<boolean>} True if request was actively cancelled
   */
  async cancelRequest(requestId) {
    // Check if this request is active
    const hordeRequestId = this.activeRequests.get(requestId);

    if (hordeRequestId) {
      console.log(`Cancelling active request ${requestId} (Horde ID: ${hordeRequestId})`);

      try {
        // Cancel on AI Horde
        await hordeApi.cancelRequest(hordeRequestId);

        // Remove from active requests
        this.activeRequests.delete(requestId);

        return true;
      } catch (error) {
        console.error(`Error cancelling request ${requestId}:`, error.message);
        // Still remove from active requests even if cancel failed
        this.activeRequests.delete(requestId);
        return false;
      }
    }

    // Request wasn't active, nothing to cancel
    return false;
  }
}

export default new QueueManager();
