/**
 * @deprecated This legacy service is deprecated. Use the new implementation from '../features/analytics/CostAllocationService' instead.
 * This module exists for backward compatibility only and will be removed after 2 releases.
 * 
 * To migrate, replace imports like:
 *   import { allocateAcquisitionCosts } from '../services/costAllocation';
 * with:
 *   import { allocateAcquisitionCosts } from '../features/analytics/CostAllocationService';
 */
import {
  allocateAcquisitionCosts,
  type AllocationMethod,
  type AllocationOptions
} from '../features/analytics/CostAllocationService';

export {
  allocateAcquisitionCosts,
  type AllocationMethod,
  type AllocationOptions
};