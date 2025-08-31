# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure with Vue 3, TypeScript, and Vite
- PWA support with offline capabilities
- IndexedDB database using Dexie.js for local data storage
- Money utility class for handling monetary values
- Basic routing with Vue Router
- Main dashboard view with portfolio statistics
- Import functionality for Cardmarket CSV files
- Import functionality for Moxfield decklists (text format)
- Views for browsing decks and cards
- Navigation component for easy access to all features

### Changed
- Updated database schema to support decks and deck cards
- Improved error handling and user feedback throughout the application

### Fixed
- Resolved build errors related to TypeScript type checking
- Fixed CORS issues with external API calls by using client-side imports instead
- Corrected regex parsing for Moxfield decklists

## [0.1.0] - 2025-08-31

### Added
- Initial release with basic functionality