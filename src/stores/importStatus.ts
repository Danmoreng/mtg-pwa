import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ImportStatus {
  id: string;
  type: 'deck' | 'cardmarket';
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export const useImportStatusStore = defineStore('importStatus', () => {
  const imports = ref<ImportStatus[]>([]);

  const addImport = (importData: Omit<ImportStatus, 'createdAt'>) => {
    const newImport: ImportStatus = {
      ...importData,
      createdAt: new Date()
    };
    imports.value.push(newImport);
    return newImport.id;
  };

  const updateImport = (id: string, updates: Partial<ImportStatus>) => {
    const importIndex = imports.value.findIndex(imp => imp.id === id);
    if (importIndex !== -1) {
      imports.value[importIndex] = { ...imports.value[importIndex], ...updates };
    }
  };

  const completeImport = (id: string, errorMessage?: string) => {
    const importIndex = imports.value.findIndex(imp => imp.id === id);
    if (importIndex !== -1) {
      imports.value[importIndex] = {
        ...imports.value[importIndex],
        status: errorMessage ? 'failed' : 'completed',
        errorMessage,
        completedAt: new Date(),
        progress: 100
      };
    }
  };

  const removeImport = (id: string) => {
    imports.value = imports.value.filter(imp => imp.id !== id);
  };

  const clearCompletedImports = () => {
    imports.value = imports.value.filter(imp => imp.status === 'pending' || imp.status === 'processing');
  };

  const getActiveImports = () => {
    return imports.value.filter(imp => imp.status === 'pending' || imp.status === 'processing');
  };

  const getCompletedImports = () => {
    return imports.value.filter(imp => imp.status === 'completed' || imp.status === 'failed');
  };

  return {
    imports,
    addImport,
    updateImport,
    completeImport,
    removeImport,
    clearCompletedImports,
    getActiveImports,
    getCompletedImports
  };
});