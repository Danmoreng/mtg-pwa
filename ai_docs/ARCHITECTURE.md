# Architecture (Authoritative)

_Status updated: 2025-09-07_

## Overview

This document describes the architecture of the MTG Collection Value Tracker, a client-only Vue 3 + TypeScript PWA using IndexedDB (Dexie) for storage and plain CSS for styling.

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      App Shell (PWA)                        │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Holdings  │  Decks  │  Scans  │  Settings    │
├─────────────────────────────────────────────────────────────┤
│                   Pinia State Stores                        │
├─────────────────────────────────────────────────────────────┤
│  Valuation  │  Pricing  │  Import  │  Linker  │  Backup     │
├─────────────────────────────────────────────────────────────┤
│                Web Workers (Background)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ CSV Parser  │  │ Price Sync  │  │ Snapshot    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Dexie Repositories                       │
├─────────────────────────────────────────────────────────────┤
│                    IndexedDB Storage                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

All monetary values are stored as integer cents to avoid floating-point precision issues.

### Core Entities

```ts
// Cards - represents a unique Magic card
cards: {
  id: string,            // Scryfall ID
  oracleId: string,      // Oracle ID for grouping
  name: string,          // Card name
  set: string,           // Set name
  setCode: string,       // Set code
  number: string,        // Collector number
  lang: string,          // Language code
  finish: string,        // Finish type (foil, nonfoil, etc.)
  imageUrl: string,      // Card image URL
  createdAt: Date,
  updatedAt: Date
}

// Holdings - represents owned cards
holdings: {
  id: string,
  cardId: string,        // Reference to cards.id
  acquisitionId: string, // Optional reference to transaction
  quantity: number,
  unitCost: number,      // In cents
  source: string,        // Source of acquisition
  condition: string,
  language: string,
  foil: boolean,
  createdAt: Date,
  updatedAt: Date
}

// Transactions - represents buys and sells
transactions: {
  id: string,
  kind: "BUY" | "SELL",
  cardId: string,        // Reference to cards.id
  quantity: number,
  unitPrice: number,     // In cents
  fees: number,          // In cents
  shipping: number,      // In cents
  currency: string,      // EUR
  source: string,
  externalRef: string,   // Idempotency key
  happenedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// Scans - represents ManaBox scanned cards
scans: {
  id: string,
  cardFingerprint: string, // Normalized tuple for identification
  cardId: string,          // Reference to cards.id (when resolved)
  source: string,
  scannedAt: Date,
  quantity: number,
  createdAt: Date,
  updatedAt: Date
}

// Decks - represents Moxfield decks
decks: {
  id: string,
  platform: "moxfield",
  name: string,
  commander: string,
  url: string,
  importedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// Deck Cards - represents cards in decks
deck_cards: {
  id: string,
  deckId: string,        // Reference to decks.id
  cardId: string,        // Reference to cards.id
  quantity: number,
  role: "main" | "side" | "maybeboard",
  createdAt: Date,
  updatedAt: Date
}

// Price Points - historical pricing data
price_points: {
  id: string,            // cardId+provider+asOf
  cardId: string,        // Reference to cards.id
  provider: string,      // "scryfall"
  currency: string,      // EUR
  price: number,         // In cents
  asOf: Date,            // Date of price
  createdAt: Date,
  updatedAt: Date
}

// Valuations - portfolio snapshots
valuations: {
  id: string,            // asOf date
  asOf: Date,            // Date of snapshot
  totalValue: number,    // In cents
  totalCostBasis: number, // In cents
  realizedPnLToDate: number, // In cents
  createdAt: Date,
  updatedAt: Date
}

// Settings - application settings
settings: {
  k: string,             // Key
  v: any,                // Value
  createdAt: Date,
  updatedAt: Date
}
```

## Pricing Pipeline

The pricing system uses Scryfall as the primary price provider with multiple caching layers:

1. **Service Worker Caching** - Persistent caching that survives app restarts
2. **In-Memory Caching** - Short-term caching during app session
3. **Database Storage** - Historical price points stored in `price_points` table

### Caching Strategy

- Scryfall API requests are cached with StaleWhileRevalidate strategy (24-hour expiration)
- Images are cached with CacheFirst strategy (30-day expiration)
- Price data is stored in the database for historical tracking
- Rate limiting is implemented (100ms delay between requests)

## Valuation Engine

The valuation engine calculates portfolio value using FIFO (First In, First Out) accounting method:

1. **Current Value** - Sum of (holding.quantity × latest price per cardId)
2. **Cost Basis** - Calculated from BUY transactions using FIFO
3. **Unrealized P/L** - Current Value - Remaining Cost Basis
4. **Realized P/L** - From SELL transactions (with fees/ship) - proportional FIFO cost

### Snapshot System

Daily snapshots are stored in the `valuations` table to track portfolio value over time.

## Deck Ownership Computation

Deck ownership is computed by matching cards in decks with holdings:
1. For each card in a deck, check if it exists in holdings
2. Calculate ownership percentage based on required vs owned quantity
3. Highlight which deck slots are fully/partially owned

## PWA/Offline Strategy

The application implements a comprehensive offline strategy:

1. **App Shell Caching** - Core application files cached via service worker
2. **Background Sync** - Price updates are queued when offline
3. **Offline Import Staging** - CSV files can be imported offline and processed when online
4. **Data Persistence** - All data stored locally in IndexedDB

## Current Capabilities (as of 2025-09-02)

### ✅ Milestone 1: Foundation (Complete)
- Vue 3 + TypeScript project with Vite
- PWA support with vite-plugin-pwa
- ESLint + Prettier configuration
- Strict TypeScript setup
- Base folder structure implementation
- Vue Router with basic layout
- CSS tokens and reset
- Dexie database with typed repositories
- Core domain types and utilities (Money, Settings)

### ✅ Enhanced Core Features
- **Deck Import Functionality**: 
  - Implemented card image fetching from Scryfall API
  - Added progress bar during import to show import status
  - Fixed UI freezing during deck import with non-blocking processing
  - Resolved database constraint errors during import
  - Improved deck detail view with grid layout and card images
- **Data Integrity**: Enhanced ownership calculation and display
- **Card Data Management**: 
  - Implemented centralized card price management using Pinia store
  - Eliminated props drilling for card data between components
  - Improved performance by centralizing data loading and caching
  - Fixed Vue warnings about non-props attributes
  - Enhanced CardComponent with modal dialog for detailed information

### ✅ Key Services Implemented
- Money utility for financial calculations
- Scryfall provider for card pricing and image fetching
- Entity linker for card identification
- Valuation engine for portfolio calculations
- Backup service for data export/import
- Snapshot service for historical tracking
- Settings service for app configuration

## Subsystems

### Import Infrastructure
- Cardmarket CSV parser worker (stub)
- Import service framework
- Basic CSV parsing utilities

### Web Workers
- Background processing for CSV parsing and price synchronization
- Prevents UI freezing during heavy operations
- Rate-limited API requests

### State Management
- Enhanced Pinia stores with improved card price management capabilities
- Cards store now handles both card data and price data centrally
- Unified MTG store that combines all individual stores

### UI Components
- Plain CSS with utility classes
- No external UI libraries
- Responsive design that works on desktop and mobile