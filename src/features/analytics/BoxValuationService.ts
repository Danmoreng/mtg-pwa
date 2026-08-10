import type MtgTrackerDb from '../../data/db';
import { AccountingQueryService, type AmountSummary } from '../accounting/AccountingQueryService';

export interface BoxValuation {
  boxPrice: AmountSummary;
  unsoldValue: AmountSummary;
  soldNetProceedsCent: number;
  realizedPnL: AmountSummary;
  unrealizedPnL: AmountSummary;
  initialQuantity: number;
  remainingQuantity: number;
  soldQuantity: number;
}

export class BoxValuationService {
  private readonly queries: AccountingQueryService;

  constructor(db: MtgTrackerDb) {
    this.queries = new AccountingQueryService(db);
  }

  async calculateBoxValue(acquisitionId: string): Promise<BoxValuation> {
    const summary = await this.queries.getAcquisitionSummary(acquisitionId);
    if (!summary || summary.acquisition.kind !== 'box') {
      throw new Error('Acquisition not found or is not a box.');
    }
    return {
      boxPrice: summary.acquisitionCost,
      unsoldValue: summary.marketValue,
      soldNetProceedsCent: summary.netSaleProceedsCent,
      realizedPnL: summary.realizedPnL,
      unrealizedPnL: summary.unrealizedPnL,
      initialQuantity: summary.initialQuantity,
      remainingQuantity: summary.remainingQuantity,
      soldQuantity: summary.soldQuantity,
    };
  }
}
