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

    // Check for pending requests every 2 seconds
    this.statusCheckInterval = setInterval(() => {
      this.processQueue();
    }, 2000);

    // Check for pending downloads every 1 second
    this.downloadCheckInterval = setInterval(() => {
      this.processDownloads();
    }, 1000);

    // Initial run
    this.processQueue();
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
            message: `Submitted to AI Horde (ID: ${response.id})`
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

    for (const [requestUuid, hordeId] of this.activeRequests.entries()) {
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
          await this.handleCompletedRequest(requestUuid, hordeId);
          this.activeRequests.delete(requestUuid);
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

      // Create pending downloads for each image
      console.log(`[Complete] Creating ${statusData.generations.length} pending downloads for ${requestUuid.substring(0, 8)}...`);
      for (const generation of statusData.generations) {
        const download = HordePendingDownload.create({
          requestId: requestUuid,
          uri: generation.img,
          fullResponse: JSON.stringify(generation)
        });
        console.log(`[Complete]   - Created download ${download.uuid.substring(0, 8)}... for image: ${generation.img}`);
      }

      HordeRequest.update(requestUuid, {
        status: 'downloading',
        message: `Downloading ${statusData.generations.length} images...`
      });

      console.log(`[Complete] ✓ Request ${requestUuid.substring(0, 8)}... completed, ${statusData.generations.length} images ready for download`);
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

          // Download the image
          console.log(`[Download] → Fetching image data for ${download.uuid.substring(0, 8)}...`);
          const imageData = await hordeApi.downloadImage(download.uri);
          console.log(`[Download] ← Received ${imageData.length} bytes`);

          // Generate filename
          const imageUuid = uuidv4();
          const imagePath = path.join(imagesDir, `${imageUuid}.png`);
          const thumbnailPath = path.join(imagesDir, `${imageUuid}_thumb.jpg`);

          // Save original image
          console.log(`[Download] Saving image to ${imageUuid}.png`);
          fs.writeFileSync(imagePath, imageData);

          // Generate square thumbnail (512x512)
          console.log(`[Download] Generating thumbnail ${imageUuid}_thumb.jpg`);
          await sharp(imageData)
            .resize(512, 512, {
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 85 })
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
            imagePath: `${imageUuid}.png`,
            thumbnailPath: `${imageUuid}_thumb.jpg`
          });

          // Delete pending download
          HordePendingDownload.delete(download.uuid);

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
          // Remove from active downloads so it can be retried
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
}

export default new QueueManager();
