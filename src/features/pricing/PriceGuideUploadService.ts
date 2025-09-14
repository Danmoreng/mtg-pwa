
import { spawn, Thread } from 'threads';
import PriceGuideWorkerCtor from './PriceGuideUploadWorker?worker';

export class PriceGuideUploadService {
  static async upload(file: File, progressCallback: (written: number) => void): Promise<void> {
    const worker = await spawn(new PriceGuideWorkerCtor(), { timeout: 300000 });

    try {
      const written = await worker.upload(file);
      progressCallback(written);
    } finally {
      await Thread.terminate(worker);
    }
  }
}
