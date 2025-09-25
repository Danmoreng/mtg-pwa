/**
 * @deprecated This legacy service is deprecated. Use the new implementation from '../features/scans/ReconcilerService' instead.
 * This module exists for backward compatibility only and will be removed after 2 releases.
 * 
 * To migrate, replace imports like:
 *   import { runReconciler } from '../services/reconciler';
 * with:
 *   import { runReconciler } from '../features/scans/ReconcilerService';
 */
import {
  remainingQty,
  findLotsByIdentity,
  findOrCreateProvisionalLot,
  linkScanToLot,
  reassignSellToLot,
  mergeLots,
  reconcileScansToLots,
  reconcileSellsToLots,
  consolidateProvisionalLots,
  runReconciler
} from '../features/scans/ReconcilerService';

export {
  remainingQty,
  findLotsByIdentity,
  findOrCreateProvisionalLot,
  linkScanToLot,
  reassignSellToLot,
  mergeLots,
  reconcileScansToLots,
  reconcileSellsToLots,
  consolidateProvisionalLots,
  runReconciler
};