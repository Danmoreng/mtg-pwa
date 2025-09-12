// Composable for handling automatic price updates
import { ref } from 'vue';
import { AutomaticPriceUpdateService } from '../features/pricing/AutomaticPriceUpdateService';
import { ValuationEngine } from '../features/analytics/ValuationEngine';

// Global state for price update information
const lastUpdate = ref<Date | null>(null);
const nextUpdate = ref<Date | null>(null);
const isUpdating = ref(false);

export function usePriceUpdates() {
  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    
    // Format as "DD.MM.YYYY HH:MM"
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Update price information
  const updatePriceInfo = async () => {
    try {
      lastUpdate.value = await AutomaticPriceUpdateService.getLastUpdateTime();
      nextUpdate.value = await AutomaticPriceUpdateService.getNextUpdateTime();
    } catch (error) {
      console.error('Error updating price info:', error);
    }
  };

  // Check and schedule price update if needed
  const checkAndScheduleUpdate = async () => {
    if (isUpdating.value) return;
    
    isUpdating.value = true;
    try {
      // Check if we need to update prices
      const needsUpdate = await AutomaticPriceUpdateService.needsPriceUpdate();
      
      if (needsUpdate) {
        // Perform the price update
        await AutomaticPriceUpdateService.schedulePriceUpdate();
        // Create a valuation snapshot after price update
        await ValuationEngine.createValuationSnapshot();
      }
      
      await updatePriceInfo();
    } catch (error) {
      console.error('Error scheduling price update:', error);
    } finally {
      isUpdating.value = false;
    }
  };

  // Force update prices
  const forceUpdatePrices = async () => {
    if (isUpdating.value) return;
    
    isUpdating.value = true;
    try {
      await AutomaticPriceUpdateService.updatePrices();
      // Create a valuation snapshot after price update
      await ValuationEngine.createValuationSnapshot();
      await updatePriceInfo();
    } catch (error) {
      console.error('Error updating prices:', error);
      throw error;
    } finally {
      isUpdating.value = false;
    }
  };

  return {
    lastUpdate,
    nextUpdate,
    isUpdating,
    formatDate,
    updatePriceInfo,
    checkAndScheduleUpdate,
    forceUpdatePrices
  };
}