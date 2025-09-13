# MTG Collection Value Tracker

A Progressive Web App (PWA) for tracking the value of your Magic: The Gathering collection.

## Features

- Track your MTG card collection value
- Import data from Cardmarket CSV exports with improved reliability and idempotency
- Import ManaBox scanned cards
- Import decks from Moxfield
- View portfolio statistics including value, cost basis, and profit/loss
- Historical price charts for individual cards
- Real-time import progress tracking
- Interactive card details with image flipping for transform cards
- Offline functionality with PWA support
- Responsive design that works on desktop and mobile

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Documentation

- [Architecture](ai_docs/ARCHITECTURE.md) - Technical architecture and data model
- [Importers](ai_docs/IMPORTERS.md) - Specifications for Cardmarket, ManaBox, and Moxfield importers
- [Roadmap](ai_docs/ROADMAP.md) - Project milestones and future plans
- [AI Collaboration](ai_docs/QWEN.md) - Guidelines for working with the AI assistant
- [AI Changelog](ai_docs/AI_CHANGELOG.md) - Historical log of AI-proposed changes

## Where did things go?

We've recently consolidated our documentation to reduce sprawl:
- Project plan moved to `ai_docs/ROADMAP.md`
- Implementation details moved to `ai_docs/ARCHITECTURE.md`
- Importer specifications moved to `ai_docs/IMPORTERS.md`
- AI collaboration rules moved to `ai_docs/QWEN.md`

## Contributing

This project follows a collaborative development model where humans run commands and AI proposes changes:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure AI changelog entry is added to `docs/AI_CHANGELOG.md`
5. Commit your changes using Conventional Commits
6. Push to the branch
7. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.