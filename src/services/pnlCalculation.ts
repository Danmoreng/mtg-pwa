/**
 * @deprecated This legacy service is deprecated. Use the new implementation from '../features/analytics/PnLService' instead.
 * This module exists for backward compatibility only and will be removed after 2 releases.
 * 
 * To migrate, replace imports like:
 *   import { getAcquisitionPnL } from '../services/pnlCalculation';
 * with:
 *   import { getAcquisitionPnL } from '../features/analytics/PnLService';
 */
import {
  getAcquisitionPnL,
  type AcquisitionPnL,
  type LotPnL
} from '../features/analytics/PnLService';

export {
  getAcquisitionPnL,
  type AcquisitionPnL,
  type LotPnL
};