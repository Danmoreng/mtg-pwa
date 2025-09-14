import { SettingsService } from '../../core/SettingsService';
import { PriceGuideSyncService } from './PriceGuideSyncService';

export class PriceGuideScheduler {
  static async run(): Promise<void> {
    const lastSync = await SettingsService.get('last_priceguide_sync_timestamp');
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (!lastSync || now - lastSync > twentyFourHours) {
      await PriceGuideSyncService.syncPriceGuide();
      await SettingsService.set('last_priceguide_sync_timestamp', now);
    }
  }
}