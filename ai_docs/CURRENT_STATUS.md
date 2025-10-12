# Current Project Status - October 12, 2025

## Overview

The MTG Collection Value Tracker has successfully completed Milestone 3 (M3) implementation, which focused on ManaBox scans & reconciliation. The system now supports acquisition-based inventory management, precise cost allocation, and sophisticated sell allocation for accurate P&L tracking.

## Completed Milestones

### M1 - Inventory Truth & Importer Reliability ✓
- Made `card_lots` the single source of truth for inventory
- Removed the `holdings` table (now computed from lots)
- Implemented idempotent imports with Product-ID-first resolution

### M2 - Pricing Throughput, History & Snapshots ✓
- Implemented price history with provider precedence (Price Guide > MTGJSON > Scryfall)
- Added MTGJSON and Cardmarket Price Guide importers
- Added automatic valuation snapshots
- Implemented finish-aware price processing (foil/nonfoil)

### M3 - ManaBox Scans & Reconciliation ✓
- Acquisition-based inventory management with cost allocation
- Sell allocation system for distributing sales across multiple lots
- Reconciler service for matching scans to lots and sales to lots
- Enhanced analytics with per-box P&L calculations

## Current Capabilities

### Data Model
- **Database Version 10** with acquisitions, lots, and sell allocations
- All monetary values stored as integer cents (EUR) to avoid float drift
- Comprehensive financial tracking per lot with acquisition/sale costs

### Import Functionality
- Cardmarket CSV import with high reliability
- ManaBox scan import with acquisition cost allocation
- Moxfield deck import
- Idempotent imports using external reference keys

### Analytics & Valuation
- Automatic valuation snapshots
- Realized/unrealized P&L calculations using FIFO methodology
- Per-box analytics and cost allocation
- Sell allocation system for precise P&L tracking across multiple lots

### User Interface
- Dashboard with portfolio analytics
- Holdings view computed from lots
- Deck management with ownership tracking
- Scan reconciliation interface
- Settings and backup/restore functionality

### PWA Features
- Offline capability with service worker
- Local-first design with IndexedDB storage
- Responsive design working on desktop and mobile

## Technical Architecture

### Core Components
- **Vue 3 + TypeScript** frontend framework
- **IndexedDB via Dexie** for local storage and migrations
- **Web Workers** for background processing (CSV parsing, price sync, reconciliation)
- **Bootstrap 5** for UI styling
- **Chart.js** for data visualization

### Service Layer
- **Import Pipelines** for Cardmarket, ManaBox, and Moxfield imports
- **Reconciler Service** for scan-to-sale matching
- **Cost Allocation Service** for distributing acquisition costs
- **P&L Service** for realized and unrealized profit calculations
- **Price Update Service** with multi-provider precedence

## Recent Updates

- M3 implementation completed with sell allocations feature
- Reconciler moved from web worker to main thread to fix stability issues
- Database schema updated to version 10 with sell_allocations table
- Feature flags removed to enable M3 functionality by default

## Next Milestones

### M4 - Manual Add & Correction
- UI for manual lot creation
- Override functionality for card resolution
- Lock mechanism to preserve manual corrections

### M5 - ManaBox Group Pricing
- Purchase groups functionality
- UI for grouping scans into purchase groups
- Per-group pricing and analytics

## Known Issues

- **Critical Reconciler Issue**: The reconciliation service is experiencing DataError and NotFoundError issues when attempting to link scans to lots and sales to lots. Based on console logs, the reconciler is failing with messages such as:
  - "DataError: Data provided to an operation does not meet requirements"
  - "NotFoundError: The operation failed because the requested database object could not be found"
- Ongoing work on Manabox import tracking card sales per box

## Development Status

The project is stable with M3 features largely implemented but requires urgent fixes for the reconciliation service. Current work must focus on resolving the critical reconciler errors before proceeding with M4 features.