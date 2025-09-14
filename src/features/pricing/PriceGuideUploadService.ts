
import {spawn, Worker} from 'threads';

export class PriceGuideUploadService {
  static async upload(file: File, progressCallback: (written: number) => void): Promise<void> {
    const worker = await spawn(new Worker('./PriceGuideUploadWorker'), { timeout: 300000 });

    worker.upload(file).then((written) => {
      progressCallback(written);
    });
  }
}
