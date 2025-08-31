# AI Change Log

A chronological log of AI-proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

## 2025-08-31 15:00 — Initial project setup and Milestone 1 implementation
- **Author**: AI (Qwen)
- **Scope**: Project structure, database schema, import functionality, UI views
- **Type**: feat
- **Summary**: Implemented core functionality for Milestone 1 including database schema, import features, and UI views.
- **Details**:
  - Set up Vue 3 + TypeScript + Vite project structure
  - Implemented Dexie.js database schema with tables for cards, holdings, transactions, decks, and deck cards
  - Created Money utility class for handling monetary values
  - Implemented Cardmarket CSV import functionality
  - Implemented Moxfield deck import functionality (text format)
  - Created UI views for dashboard, deck browsing, card browsing, and data import
  - Added navigation component for easy access to all features
  - Fixed build errors and TypeScript type issues
  - Resolved CORS issues by using client-side imports instead of API calls
- **Impact/Risks**: 
  - Schema changes require database version update
  - Moxfield import uses text format instead of API due to CORS restrictions
- **Verification Steps**: 
  - `npm install` to install dependencies
  - `npm run build` to verify build succeeds
  - `npm run dev` to start development server
  - Import a Cardmarket CSV file and verify data is stored
  - Import a Moxfield decklist and verify deck appears in the decks view
  - Browse cards and decks through the UI
- **Linked Task/Issue**: Milestone 1