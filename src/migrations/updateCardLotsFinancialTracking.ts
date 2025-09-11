import db from '../data/db';
import { cardLotRepository } from '../data/repos';
import { Money } from '../core/Money';

/**
 * Migration script to update existing card lots with enhanced financial tracking fields
 * This script adds the new financial tracking fields to existing card lots
 */
async function updateCardLotsFinancialTracking() {
  console.log('Starting migration: Update card lots with enhanced financial tracking...');
  
  try {
    // Get all card lots
    const lots = await cardLotRepository.getAll();
    
    console.log(`Found ${lots.length} card lots to update`);
    
    let updatedCount = 0;
    
    // Update each lot with the new financial tracking fields
    for (const lot of lots) {
      // Skip lots that already have the new fields
      if (lot.acquisitionPriceCent !== undefined) {
        continue;
      }
      
      // Prepare update data with enhanced financial tracking fields
      const updateData: Partial<any> = {
        // Acquisition cost tracking (purchase)
        acquisitionPriceCent: lot.unitCost, // Use existing unitCost as base
        acquisitionFeesCent: 0, // Default to 0, will be updated when order data is available
        acquisitionShippingCent: 0, // Default to 0, will be updated when order data is available
        totalAcquisitionCostCent: lot.unitCost, // Use existing unitCost as base
        
        // Sale tracking (if lot has been sold)
        salePriceCent: lot.salePriceCent || undefined,
        saleFeesCent: lot.saleFeesCent || undefined,
        saleShippingCent: lot.saleShippingCent || undefined,
        totalSaleRevenueCent: lot.totalSaleRevenueCent || undefined,
        
        // Profit calculation
        netProfitPerUnitCent: lot.netProfitPerUnitCent || undefined,
        totalNetProfitCent: lot.totalNetProfitCent || undefined
      };
      
      // Update the lot
      await cardLotRepository.update(lot.id, updateData);
      updatedCount++;
      
      // Log progress every 100 lots
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} card lots...`);
      }
    }
    
    console.log(`Migration completed successfully. Updated ${updatedCount} card lots.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  updateCardLotsFinancialTracking()
    .then(() => {
      console.log('Migration finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed with error:', error);
      process.exit(1);
    });
}

export default updateCardLotsFinancialTracking;