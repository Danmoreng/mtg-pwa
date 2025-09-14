
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {MTGJSONUploadService} from '../../features/pricing/MTGJSONUploadService';
import {cardRepository, pricePointRepository} from '../../data/repos';
import {fflate} from 'fflate';

// Mock the worker
vi.mock('threads', () => ({
  spawn: vi.fn().mockResolvedValue({
    upload: vi.fn().mockImplementation(async (file, wantedIds) => {
      const buffer = await file.arrayBuffer();
      const decompressed = fflate.decompressSync(new Uint8Array(buffer));
      const json = JSON.parse(new TextDecoder().decode(decompressed));

      let written = 0;
      for (const cardId of wantedIds) {
        if (json.data[cardId]) {
          written++;
        }
      }
      return written;
    }),
    terminate: vi.fn(),
  }),
  Worker: vi.fn(),
}));

describe('MTGJSONUploadWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload and process MTGJSON data', async () => {
    const json = {
      data: {
        'card-1': {
          paper: {
            cardmarket: {
              retail: {
                normal: {
                  '2025-09-14': 1.23,
                },
                foil: {
                  '2025-09-14': 4.56,
                },
              },
            },
          },
        },
      },
    };

    const compressed = fflate.compressSync(new TextEncoder().encode(JSON.stringify(json)));
    const file = new File([compressed], 'all-prices.json.gz', { type: 'application/gzip' });

    vi.spyOn(cardRepository, 'getAll').mockResolvedValue([{ id: 'card-1' }] as any);
    const bulkPutSpy = vi.spyOn(pricePointRepository, 'bulkPut').mockResolvedValue([] as any);

    let writtenCount = 0;
    await MTGJSONUploadService.upload(file, (written) => {
      writtenCount = written;
    });

    // This is a simplified test due to worker mocking. 
    // A full e2e test would be better.
    expect(writtenCount).toBe(1);
  });
});
