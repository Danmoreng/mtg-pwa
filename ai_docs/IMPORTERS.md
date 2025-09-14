# Importer Specifications

This document describes the specifications for all supported importers in the MTG Collection Value Tracker.

## MTGJSON Importer

### Supported Formats
The importer supports the MTGJSON `AllPrices.json.gz` format:

- `AllPrices.json.gz` - Full historical pricing data (large file)
- `AllPricesToday.json` - Latest pricing data only (smaller file)

### Data Processing
The importer processes only pricing data for cards in the user's collection:

1. Extracts Cardmarket pricing data from the MTGJSON file
2. Filters to only include cards present in the user's collection
3. Processes pricing history for the last 90 days
4. Maps MTGJSON finish types to application finish types:
   - `normal` → `nonfoil`
   - `foil` → `foil`
   - `etched` → `etched`

### File Size Limits
- Maximum decompressed file size: 1.5GB
- Files exceeding this limit will be rejected with an error message

### Idempotency
The importer uses idempotent database operations, so re-importing the same file will not create duplicate records.

### Error Handling
- **Large Files**: Files that are too large are rejected with a clear error message
- **Memory Issues**: Out-of-memory errors are caught and users are advised to use smaller files
- **Parsing Errors**: JSON parsing errors are caught and reported to the user

## Cardmarket CSV Importer

### Supported Formats
The importer supports multiple Cardmarket export formats:
- Transaction exports (buys & sells)
- Order exports
- Article exports

### Required Columns
The following columns are required for proper parsing:
- `Date` - Transaction date
- `Product` - Card name
- `Expansion` - Set name
- `Nr` - Collector number
- `Language` - Card language
- `Condition` - Card condition
- `Foil` - Foil status (true/false or yes/no)
- `Price` - Unit price
- `Quantity` - Number of cards
- `Fees` - Transaction fees (optional)
- `Shipping` - Shipping costs (optional)
- `OrderId` - Order identifier (for idempotency)

### Parsing Rules
1. **Date Format**: Parsed as DD.MM.YYYY or YYYY-MM-DD
2. **Price Parsing**: Converted to cents (integer) to avoid floating-point issues
3. **Foil Detection**: Accepts various formats (true/false, yes/no, foil/nonfoil)
4. **Language Normalization**: Standardized to 2-letter codes (en, de, fr, etc.)
5. **Condition Mapping**: 
   - MT (Mint) → NM
   - NM (Near Mint) → NM
   - EX (Excellent) → EX
   - GD (Good) → GD
   - LP (Lightly Played) → LP
   - PL (Played) → PL
   - PO (Poor) → PO

### Idempotency
Each transaction is uniquely identified by:
```
externalRef = "cardmarket:" + OrderId + ":" + lineNumber
```

This prevents duplicate imports when the same CSV is imported multiple times.

### Card Resolution
Cardmarket imports now use a Product-ID-first resolution approach:
1. **Primary**: Resolve cards using Cardmarket Product IDs when available
2. **Fallback**: Use name/set/collector number resolution when Product IDs are not available
3. **Enhanced Matching**: Multi-ID parsing for cards with multiple Product IDs

### Error Handling
- **Unknown Sets**: Logged and skipped with details
- **Invalid Prices**: Rows with unparseable prices are skipped
- **Malformed Rows**: Incomplete rows are skipped with line number
- **Currency Issues**: Only EUR is supported; other currencies are skipped

### Sample CSV
```csv
Date,Product,Expansion,Nr,Language,Condition,Foil,Price,Quantity,Fees,Shipping,OrderId
15.08.2025,"Lightning Bolt","Summer Magic",90,English,NM,Normal,0.25,4,0.10,0.50,123456789
15.08.2025,"Counterspell","Summer Magic",45,English,NM,Foil,1.50,2,0.10,0.50,123456789
```

## ManaBox CSV Importer

### Supported Formats
Supports various ManaBox export formats with different column arrangements.

### Required Columns
- `Name` - Card name
- `Set` - Set name
- `Collector` - Collector number
- `Language` - Card language
- `Foil` - Foil status
- `Condition` - Card condition
- `Qty` - Quantity
- `ScanDate` - Date of scan

### Card Fingerprint
Cards are identified using a normalized fingerprint:
```
cardFingerprint = normalize(name,setCode,collectorNumber,finish,language)
```

Normalization includes:
- Removing punctuation and special characters
- Converting to lowercase
- Standardizing language codes
- Standardizing finish types

### Scan Matching Algorithm
The matching algorithm links scanned cards to sales using a greedy FIFO approach:

1. For each scan, expand into quantity singletons with key:
   ```
   K = (cardId||fingerprint, foil, language)
   ```
2. Get all SELL transactions with same K and `happenedAt >= scannedAt`, sorted by date
3. Assign units to earliest sale lots with remaining quantity
4. Store link as `soldTransactionId` on scan

### Partial Matches
When scanned quantity exceeds sold quantity, the remainder is marked as "Still Owned".

### Sample CSV
```csv
Name,Set,Collector,Language,Foil,Condition,Qty,ScanDate
"Lightning Bolt","Summer Magic",90,English,No,NM,4,2025-08-15
"Counterspell","Summer Magic",45,English,Yes,NM,2,2025-08-15
```

## Moxfield Deck Importer

### Import Flow
1. User provides Moxfield deck URL or ID
2. Application fetches deck JSON from public API
3. Parses mainboard and commander sections
4. Resolves cards to `cardId` using EntityLinker
5. Creates/updates `decks` and `deck_cards` records

### Ownership Calculation
For each card in the deck:
1. Check if card exists in holdings
2. Compare required quantity vs owned quantity
3. Calculate ownership percentage
4. Highlight fully/partially owned cards

### Rate Limiting
Moxfield API requests are rate-limited to respect service limits.

### Error Handling
- **Private Decks**: Proper error message when deck is not public
- **Missing Images**: Fallback handling for cards without images
- **Network Issues**: Retry logic with exponential backoff

### Sample URL
```
https://www.moxfield.com/decks/example-deck-id
```

## General Error Handling & Duplicate Detection

### Validation Process
1. Parse CSV/JSON data
2. Validate required fields
3. Normalize data formats
4. Check for duplicates using idempotency keys
5. Resolve card identifiers using EntityLinker
6. Store in appropriate database tables

### Duplicate Detection
- **Cardmarket**: Uses `externalRef` based on OrderId and line number
- **ManaBox**: Uses combination of fingerprint and scan date
- **Moxfield**: Uses deck ID to prevent duplicate imports

### Error Reporting
All import errors are logged with:
- Line number (for CSV imports)
- Card name and set
- Specific error description
- Timestamp