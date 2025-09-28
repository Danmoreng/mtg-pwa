import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useImportStatusStore } from './importStatus';

describe('ImportStatus Store', () => {
  beforeEach(() => {
    // Create a new pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should initialize with empty imports', () => {
    const store = useImportStatusStore();
    expect(store.imports).toEqual([]);
  });

  it('should add a new import with correct properties', () => {
    const store = useImportStatusStore();
    const importData = {
      id: 'test-import',
      type: 'pricing' as const,
      name: 'Test Import',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };

    const importId = store.addImport(importData);

    expect(store.imports).toHaveLength(1);
    expect(store.imports[0]).toMatchObject({
      id: 'test-import',
      type: 'pricing',
      name: 'Test Import',
      status: 'pending',
      progress: 0,
      totalItems: 100,
      processedItems: 0,
      createdAt: expect.any(Date)
    });
    expect(importId).toBe('test-import');
  });

  it('should update an existing import', () => {
    const store = useImportStatusStore();
    const importData = {
      id: 'test-import',
      type: 'pricing' as const,
      name: 'Test Import',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };

    store.addImport(importData);

    store.updateImport('test-import', {
      status: 'processing',
      progress: 50,
      processedItems: 50
    });

    expect(store.imports).toHaveLength(1);
    expect(store.imports[0]).toMatchObject({
      id: 'test-import',
      type: 'pricing',
      name: 'Test Import',
      status: 'processing',
      progress: 50,
      totalItems: 100,
      processedItems: 50
    });
  });

  it('should complete an import successfully', () => {
    const store = useImportStatusStore();
    const importData = {
      id: 'test-import',
      type: 'pricing' as const,
      name: 'Test Import',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };

    store.addImport(importData);

    store.completeImport('test-import');

    expect(store.imports).toHaveLength(1);
    expect(store.imports[0]).toMatchObject({
      id: 'test-import',
      type: 'pricing',
      name: 'Test Import',
      status: 'completed',
      progress: 100,
      totalItems: 100,
      processedItems: 0,
      completedAt: expect.any(Date)
    });
    expect(store.imports[0].errorMessage).toBeUndefined();
  });

  it('should complete an import with error', () => {
    const store = useImportStatusStore();
    const importData = {
      id: 'test-import',
      type: 'pricing' as const,
      name: 'Test Import',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };

    store.addImport(importData);

    const errorMessage = 'Test error message';
    store.completeImport('test-import', errorMessage);

    expect(store.imports).toHaveLength(1);
    expect(store.imports[0]).toMatchObject({
      id: 'test-import',
      type: 'pricing',
      name: 'Test Import',
      status: 'failed',
      progress: 100,
      totalItems: 100,
      processedItems: 0,
      completedAt: expect.any(Date),
      errorMessage: errorMessage
    });
  });

  it('should remove an import', () => {
    const store = useImportStatusStore();
    const importData1 = {
      id: 'test-import-1',
      type: 'pricing' as const,
      name: 'Test Import 1',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };
    const importData2 = {
      id: 'test-import-2',
      type: 'pricing' as const,
      name: 'Test Import 2',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };

    store.addImport(importData1);
    store.addImport(importData2);

    expect(store.imports).toHaveLength(2);

    store.removeImport('test-import-1');

    expect(store.imports).toHaveLength(1);
    expect(store.imports[0].id).toBe('test-import-2');
  });

  it('should get active imports correctly', () => {
    const store = useImportStatusStore();
    const importData1 = {
      id: 'test-import-1',
      type: 'pricing' as const,
      name: 'Test Import 1',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };
    const importData2 = {
      id: 'test-import-2',
      type: 'pricing' as const,
      name: 'Test Import 2',
      status: 'processing' as const,
      progress: 50,
      totalItems: 100,
      processedItems: 50
    };
    const importData3 = {
      id: 'test-import-3',
      type: 'pricing' as const,
      name: 'Test Import 3',
      status: 'completed' as const,
      progress: 100,
      totalItems: 100,
      processedItems: 100,
      completedAt: new Date()
    };

    store.addImport(importData1);
    store.addImport(importData2);
    store.addImport(importData3);

    const activeImports = store.getActiveImports();
    expect(activeImports).toHaveLength(2);
    expect(activeImports[0].id).toBe('test-import-1');
    expect(activeImports[1].id).toBe('test-import-2');
  });

  it('should get completed imports correctly', () => {
    const store = useImportStatusStore();
    const importData1 = {
      id: 'test-import-1',
      type: 'pricing' as const,
      name: 'Test Import 1',
      status: 'pending' as const,
      progress: 0,
      totalItems: 100,
      processedItems: 0
    };
    const importData2 = {
      id: 'test-import-2',
      type: 'pricing' as const,
      name: 'Test Import 2',
      status: 'completed' as const,
      progress: 100,
      totalItems: 100,
      processedItems: 100,
      completedAt: new Date()
    };
    const importData3 = {
      id: 'test-import-3',
      type: 'pricing' as const,
      name: 'Test Import 3',
      status: 'failed' as const,
      progress: 100,
      totalItems: 100,
      processedItems: 100,
      completedAt: new Date(),
      errorMessage: 'Test error'
    };

    store.addImport(importData1);
    store.addImport(importData2);
    store.addImport(importData3);

    const completedImports = store.getCompletedImports();
    expect(completedImports).toHaveLength(2);
    expect(completedImports[0].id).toBe('test-import-2');
    expect(completedImports[1].id).toBe('test-import-3');
  });

  it('should support all import types including pricing', () => {
    const store = useImportStatusStore();
    
    // Test deck import
    store.addImport({
      id: 'deck-import',
      type: 'deck',
      name: 'Deck Import',
      status: 'pending',
      progress: 0,
      totalItems: 10,
      processedItems: 0
    });
    
    // Test cardmarket import
    store.addImport({
      id: 'cardmarket-import',
      type: 'cardmarket',
      name: 'Cardmarket Import',
      status: 'pending',
      progress: 0,
      totalItems: 20,
      processedItems: 0
    });
    
    // Test pricing import
    store.addImport({
      id: 'pricing-import',
      type: 'pricing',
      name: 'Price Updates',
      status: 'pending',
      progress: 0,
      totalItems: 30,
      processedItems: 0
    });
    
    expect(store.imports).toHaveLength(3);
    
    // Verify all types are supported
    const types = store.imports.map(imp => imp.type);
    expect(types).toContain('deck');
    expect(types).toContain('cardmarket');
    expect(types).toContain('pricing');
  });
});