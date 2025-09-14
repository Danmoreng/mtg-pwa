import {spawn, Worker} from 'threads';
import {cardRepository} from '../../data/repos';
import MTGJSONUploadWorker from './MTGJSONUploadWorker?worker';

export class MTGJSONUploadService {
  static async upload(file: File, progressCallback: (written: number) => void): Promise<void> {
    console.log(`[MTGJSONUploadService] Starting upload for file: ${file.name}`);
    try {
      console.log('[MTGJSONUploadService] Spawning worker...');
      // Add a 5-minute timeout for worker initialization
      const uploadWorker = await spawn(new MTGJSONUploadWorker(), { timeout: 300000 });
      console.log('[MTGJSONUploadService] Worker spawned.');

      console.log('[MTGJSONUploadService] Fetching wanted card IDs...');
      const wantedIds = (await cardRepository.getAll()).map(c => c.id);
      console.log(`[MTGJSONUploadService] Found ${wantedIds.length} wanted card IDs.`);

      console.log('[MTGJSONUploadService] Calling worker.upload()...');
      try {
        const written = await uploadWorker.upload(file, wantedIds);
        console.log(`[MTGJSONUploadService] Worker finished processing. ${written} cards processed.`);
        progressCallback(written);
      } catch (error) {
        console.error('[MTGJSONUploadService] Worker returned an error:', error);
        throw error;
      } finally {
        console.log('[MTGJSONUploadService] Terminating worker.');
        await Worker.terminate(uploadWorker);
      }

    } catch (error) {
      console.error('[MTGJSONUploadService] An error occurred in the upload service:', error);
      throw error;
    }
  }
}