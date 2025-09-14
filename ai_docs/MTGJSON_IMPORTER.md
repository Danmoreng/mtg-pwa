# MTGJSON Importer

This document describes the MTGJSON importer implementation in the MTG Collection Value Tracker.

## Overview

The MTGJSON importer allows users to upload the `AllPrices.json.gz` file from MTGJSON to backfill price history for their collection. This provides up to 90 days of historical pricing data for cards in the user's collection.

## Implementation

### Architecture

The importer follows a worker-based architecture to handle the large file size of the MTGJSON data:

1. **MTGJSONUploadService** - Main service that coordinates the upload process
2. **MTGJSONUploadWorker** - Web worker that handles the actual file processing
3. **MtgjsonImportWizard** - Vue component that provides the user interface

### File Processing

The importer processes the MTGJSON file in the following steps:

1. **File Upload** - User selects the `AllPrices.json.gz` file
2. **Decompression** - The gzipped file is decompressed in the browser
3. **JSON Parsing** - The large JSON file is parsed
4. **Filtering** - Only price data for cards in the user's collection is processed
5. **Data Extraction** - Price points are extracted for the last 90 days
6. **Database Storage** - Price points are stored in the `price_points` table

### Memory Management

To handle the large file size (often 1+ GB when decompressed), the importer implements several memory management techniques:

1. **Batched Processing** - Cards are processed in small batches to reduce memory usage
2. **Batched Database Inserts** - Price points are inserted in batches to avoid memory issues
3. **File Size Limits** - Files larger than 1.5GB when decompressed are rejected with a helpful error message
4. **Cooperative Multitasking** - Brief pauses are inserted between processing batches to allow the browser to handle other tasks

### Error Handling

The importer includes comprehensive error handling:

1. **File Size Limits** - Files that are too large are rejected with a clear error message
2. **Memory Issues** - Out-of-memory errors are caught and users are advised to use smaller files
3. **Worker Termination** - Proper cleanup of web workers is ensured even in error conditions
4. **User Guidance** - Clear error messages guide users toward solutions (e.g., using AllPricesToday.json instead)

## Usage

### Getting the File

Users can download the `AllPrices.json.gz` file from the [MTGJSON website](https://mtgjson.com/downloads/all-files/).

Note: For better performance and to avoid memory issues, users can alternatively download the smaller `AllPricesToday.json` file which contains only the latest prices.

### Import Process

1. Navigate to the MTGJSON import wizard
2. Select the `AllPrices.json.gz` file
3. Click "Import Prices"
4. Wait for the import to complete
5. View price history charts for cards in your collection

## Technical Details

### Data Model

Price points are stored in the `price_points` table with the following structure:

- `id`: `${cardId}:mtgjson.cardmarket:${finish}:${date}`
- `cardId`: The Scryfall ID of the card
- `provider`: `mtgjson.cardmarket`
- `finish`: `nonfoil`, `foil`, or `etched`
- `date`: ISO date string (YYYY-MM-DD)
- `currency`: EUR
- `priceCent`: Price in integer cents
- `asOf`: Timestamp when the price point was recorded
- `createdAt`: Timestamp when the record was created

### Provider Precedence

The MTGJSON importer uses `mtgjson.cardmarket` as the provider value, which fits into the overall pricing precedence:

1. Cardmarket Price Guide (`cardmarket.priceguide`)
2. MTGJSON (Cardmarket) (`mtgjson.cardmarket`)
3. Scryfall (`scryfall`)

### Finish Mapping

MTGJSON uses different finish terminology than the application. The importer maps:

- `normal` → `nonfoil`
- `foil` → `foil`
- `etched` → `etched`

## Limitations

### File Size

The importer has a 1.5GB limit for decompressed files to prevent out-of-memory errors in browsers.

### Browser Compatibility

The importer requires modern browser features and may not work in older browsers.

### Performance

Processing large files can take several minutes and may temporarily freeze the browser UI.

## Troubleshooting

### Out of Memory Errors

If you encounter out-of-memory errors:

1. Use the smaller `AllPricesToday.json` file instead
2. Close other browser tabs to free up memory
3. Restart your browser to clear memory
4. Try using a browser with better memory management (Chrome, Firefox, Edge)

### File Too Large

If you receive a "file too large" error:

1. Download the `AllPricesToday.json` file instead
2. Wait for a future update that may increase the file size limit

### Worker Termination Errors

If you see worker termination errors:

1. Refresh the page and try again
2. Check browser console for more detailed error information
3. Report the issue with console logs if it persists