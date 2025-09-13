# Milestone 2 Implementation Guide: Pricing Throughput, History & Snapshots

## Overview
This guide outlines the implementation plan for completing Milestone 2 of the MTG Collection Value Tracker. The goal is to achieve fast daily pricing with finish-aware time series, historical backfill, provider precedence, and automatic valuation snapshots.

## Current Status
✅ **Partially Implemented**:
- Batch price fetching using Scryfall's collection endpoint
- Finish-aware price points (regular/foil separation)
- Basic valuation snapshots after price updates

❌ **Missing Components**:
- Schema updates for provider/finish/date key format
- Historical backfill from MTGJSON (90 days)
- Daily Cardmarket Price Guide ingestion
- Provider precedence rules
- Enhanced charts with finish/provider toggles
- Service Worker Periodic Sync

## Implementation Roadmap

### Phase 1: Schema Updates & Data Model

#### 1.1 Update Price Points Schema
**File**: `src/data/db.ts`
**Changes**:
- Update `price_points` table schema to use new key format: `${cardId}:${provider}:${finish}:${date}`
- Add finish-aware fields: `finish`, `avg1dCent`, `avg7dCent`, `avg30dCent`
- Add provider field to distinguish data sources
- Add `sourceRev` field for tracking data source versions

```ts
export interface PricePoint {
  id: string; // `${cardId}:${provider}:${finish}:${date}`
  cardId: string;
  provider: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide';
  finish: 'nonfoil' | 'foil' | 'etched';
  date: string; // 'YYYY-MM-DD'
  currency: 'EUR';
  priceCent: number; // integer cents
  avg1dCent?: number;
  avg7dCent?: number;
  avg30dCent?: number;
  sourceRev?: string; // e.g., priceguide file build date / MTGJSON version
  asOf: Date;
  createdAt: Date;
}
```

#### 1.2 Add Provider ID Mapping (if needed)
**File**: `src/data/db.ts`
**Changes**:
- Add optional `provider_id_map` table if Cardmarket product IDs aren't already on cards
- Or ensure Cardmarket product IDs are persisted on the `card` entity

### Phase 2: Historical Backfill (MTGJSON)

#### 2.1 Create MTGJSON Backfill Service
**File**: `src/features/pricing/MTGJSONBackfillService.ts`
**Features**:
- Download MTGJSON AllPrices.json or use MTGGraphQL
- Filter for owned/ever-owned printings
- Extract last 90 days of Cardmarket history per printing
- Upsert into `price_points` with `provider='mtgjson.cardmarket'`

#### 2.2 Add Backfill Worker
**File**: `src/workers/MTGJSONBackfillWorker.ts`
**Features**:
- Worker to handle the backfill process in background
- Progress tracking and error handling
- One-time execution triggered on first M2 implementation

### Phase 3: Daily Price Guide Ingestion

#### 3.1 Create PriceGuideSyncWorker
**File**: `src/workers/PriceGuideSyncWorker.ts`
**Features**:
- Download Cardmarket daily price guide (CSV/JSON)
- Filter for relevant Cardmarket product IDs (owned/favorited)
- Map to local card IDs
- Upsert into `price_points` with `provider='cardmarket.priceguide'`
- Store average prices (avg1d, avg7d, avg30d) when available

#### 3.2 Add Scheduling Mechanism
**File**: `src/features/pricing/PriceGuideScheduler.ts`
**Features**:
- Service Worker Periodic Sync when supported
- App-level fallback timer with 24h TTL
- Respect user's offline status and network conditions

### Phase 4: Provider Precedence & Data Integration

#### 4.1 Implement Provider Precedence Logic
**File**: `src/features/pricing/PriceQueryService.ts`
**Features**:
- Query logic that respects provider precedence:
  1. Cardmarket Price Guide (highest priority)
  2. MTGJSON Cardmarket (within ~90 days)
  3. Scryfall (today only)
- Handle cases where multiple providers have data for the same date

#### 4.2 Update Price Update Service
**File**: `src/features/pricing/PriceUpdateService.ts`
**Changes**:
- Integrate new provider precedence rules
- Update batch fetching to handle provider-specific logic
- Maintain backward compatibility

### Phase 5: Enhanced UI & Charts

#### 5.1 Update Card Detail Charts
**File**: `src/components/PriceHistoryChart.vue`
**Features**:
- Toggle between finishes (nonfoil/foil/etched)
- Toggle between providers (Cardmarket Price Guide, MTGJSON, Scryfall)
- Overlay average lines (avg7/avg30) when available from Price Guide
- Improved legend and tooltips

#### 5.2 Add Chart Controls
**File**: `src/components/CardDetail.vue`
**Features**:
- Provider selection dropdown
- Finish toggle buttons
- Date range selector
- Export functionality for price data

### Phase 6: Testing & Validation

#### 6.1 Add Comprehensive Tests
**Files**: 
- `src/test/features/pricePointPrecedence.test.ts`
- `src/test/workers/priceGuideSyncWorker.test.ts`
- `src/test/features/mtgjsonBackfill.test.ts`

**Test Areas**:
- Provider ID mapping correctness
- Finish mapping accuracy
- Provider precedence enforcement
- Upsert idempotency
- Point-in-time valuation correctness
- Chart rendering with different providers/finishes

#### 6.2 Performance Testing
**File**: `src/test/performance/priceUpdatePerformance.test.ts`
**Features**:
- Test 5k card update performance (≤5 min P50 / ≤10 min P95)
- Validate batch sizing and backoff mechanisms
- Measure memory usage and UI responsiveness

### Phase 7: Documentation & Rollout

#### 7.1 Update Documentation
**Files**:
- `ai_docs/ARCHITECTURE.md` - Update pricing pipeline section
- `ai_docs/IMPORTERS.md` - Add pricing data sources section
- `README.md` - Update features list

#### 7.2 Migration Guide
**File**: `ai_docs/MIGRATION_M2.md`
**Content**:
- Schema migration steps
- Backfill process explanation
- New UI features walkthrough
- Provider precedence documentation

## Technical Implementation Details

### Data Model Changes

#### Updated PricePoint Interface
```ts
export interface PricePoint {
  id: string; // Format: `${cardId}:${provider}:${finish}:${date}`
  cardId: string;
  provider: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide';
  finish: 'nonfoil' | 'foil' | 'etched';
  date: string; // ISO date format: 'YYYY-MM-DD'
  currency: 'EUR';
  priceCent: number; // Price in integer cents
  avg1dCent?: number; // 1-day average in cents
  avg7dCent?: number; // 7-day average in cents
  avg30dCent?: number; // 30-day average in cents
  sourceRev?: string; // Source version/build identifier
  asOf: Date; // When this price point was recorded
  createdAt: Date; // When this record was created
}
```

#### Database Schema Update
```ts
// Version X - Enhanced price points schema
this.version(X).stores({
  price_points: 'id, cardId, provider, finish, date, asOf, createdAt, [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]'
});
```

### Provider Precedence Logic

```ts
// PriceQueryService.ts
export class PriceQueryService {
  static async getPriceForDate(cardId: string, date: Date): Promise<PricePoint | null> {
    const dateString = date.toISOString().split('T')[0];
    
    // 1. Try Cardmarket Price Guide first (highest precedence)
    let pricePoint = await db.price_points
      .where('[cardId+provider+finish+date]')
      .equals([cardId, 'cardmarket.priceguide', 'any', dateString])
      .first();
    
    if (pricePoint) return pricePoint;
    
    // 2. Try MTGJSON Cardmarket (within 90 days)
    const ninetyDaysAgo = new Date(date.getTime() - (90 * 24 * 60 * 60 * 1000));
    pricePoint = await db.price_points
      .where('[cardId+provider+finish+date]')
      .equals([cardId, 'mtgjson.cardmarket', 'any', dateString])
      .filter(pp => new Date(pp.asOf) >= ninetyDaysAgo)
      .first();
    
    if (pricePoint) return pricePoint;
    
    // 3. Fall back to Scryfall for today only
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) {
      pricePoint = await db.price_points
        .where('[cardId+provider+finish+date]')
        .equals([cardId, 'scryfall', 'any', dateString])
        .first();
    }
    
    return pricePoint || null;
  }
}
```

### Finish Mapping

```ts
// utils/finishMapper.ts
export function mapFinish(sourceFinish: string): 'nonfoil' | 'foil' | 'etched' {
  const normalized = sourceFinish.toLowerCase();
  
  if (normalized.includes('foil') || normalized.includes('foil')) {
    return 'foil';
  } else if (normalized.includes('etched') || normalized.includes('etched')) {
    return 'etched';
  } else {
    return 'nonfoil';
  }
}
```

## Acceptance Criteria Validation

### Performance Targets
- [ ] Backfill coverage: ≥95% of owned printings have ≥90 consecutive daily points
- [ ] Daily sync reliability: ≥97% success rate (last 30 days)
- [ ] Throughput: Update 5k cards in ≤5 min P50 / ≤10 min P95
- [ ] Snapshots: Valuation snapshot created within ≤60s of price update completion
- [ ] Finish visibility: Both EUR and EUR foil series render when applicable

### Data Quality
- [ ] Provider precedence honored when multiple providers have the same date
- [ ] Point-in-time valuations use correct provider/date combinations
- [ ] Historical data completeness maintained (≥95% coverage)

### UI/UX
- [ ] Card detail charts toggle finish and provider
- [ ] Average lines (avg7/avg30) overlay when available from Price Guide
- [ ] Dashboard filters work with historical data joins

## Risk Mitigation

### API Rate Limits
- Implement batch sizes with backoff strategies
- Add TTL guards to prevent excessive API calls
- Implement offline queue for deferred processing

### Data Consistency
- Ensure upserts are idempotent by (cardId, provider, finish, date)
- Add validation for mapping between providers and local cards
- Implement graceful degradation when external data sources are unavailable

### User Experience
- Provide clear progress indicators during backfill and sync operations
- Handle offline scenarios gracefully with local caching
- Ensure UI remains responsive during background operations

## Dependencies
- [x] M1 completion (lots as source of truth)
- [ ] Dexie schema migration capabilities
- [ ] Worker infrastructure for background processing
- [ ] Charting library support for multiple series and overlays

## Next Steps
1. Begin with schema updates and migration
2. Implement MTGJSON backfill service
3. Create PriceGuideSyncWorker
4. Add provider precedence logic
5. Enhance UI components
6. Add comprehensive tests
7. Validate performance targets
8. Update documentation

This implementation will provide a robust, performant pricing system that meets all M2 acceptance criteria while maintaining compatibility with the existing architecture.