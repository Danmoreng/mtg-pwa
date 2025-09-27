/**
 * @deprecated This legacy service is deprecated. Use the new implementation from '../features/imports/ImportPipelines' instead.
 * This module exists for backward compatibility only and will be removed after 2 releases.
 * 
 * To migrate, replace imports like:
 *   import { importCardmarketSells } from '../services/importService';
 * with:
 *   import { importCardmarketSells } from '../features/imports/ImportPipelines';
 */
import {
  importManaboxScansWithBoxCost,
  importCardmarketSells,
  importDecks,
  type ManaboxImportRow,
  type BoxCost,
  type CardmarketSellOrderLine,
  type DeckImportRow
} from '../features/imports/ImportPipelines';

export {
  importManaboxScansWithBoxCost,
  importCardmarketSells,
  importDecks,
  type ManaboxImportRow,
  type BoxCost,
  type CardmarketSellOrderLine,
  type DeckImportRow
};