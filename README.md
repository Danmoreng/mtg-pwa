# MTG Collection Value Tracker

A Progressive Web App (PWA) for tracking the value of your Magic: The Gathering collection.

## Features

- Track your MTG card collection value
- Import data from Cardmarket CSV exports
- Import decks from Moxfield (text format)
- View portfolio statistics including value, cost basis, and profit/loss
- Offline functionality with PWA support
- Responsive design that works on desktop and mobile

## Tech Stack

- Vue 3 with TypeScript
- Vite for build tooling
- Dexie.js for IndexedDB database management
- Vue Router for navigation
- Vite PWA plugin for PWA functionality

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

### Building

Build the application for production:
```bash
npm run build
```

### Testing

Run the test suite:
```bash
npm run test
```

## Usage

1. Import your Cardmarket transaction data through the CSV import feature
2. Import your decks from Moxfield by copying the text export
3. View your collection value and statistics on the dashboard
4. Browse your decks and cards through the dedicated views

## Project Structure

```
src/
├── app/           # Application shell and routing
├── components/    # Reusable UI components
├── core/          # Core utilities and business logic
├── data/          # Database models and repositories
├── features/      # Feature modules
│   ├── analytics/ # Portfolio analytics and calculations
│   ├── dashboard/ # Dashboard views
│   ├── decks/     # Deck management
│   ├── imports/   # Data import functionality
│   ├── linker/    # Entity linking utilities
│   ├── pricing/   # Pricing providers
│   └── scans/     # Scan matching functionality
├── test/          # Test setup and utilities
├── ui/            # UI components and styles
└── workers/       # Web workers for background tasks
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit your changes
5. Push to the branch
6. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.