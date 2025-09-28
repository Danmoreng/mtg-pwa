// AcquisitionService.ts
// Service for managing acquisitions (boxes/collections)

import { acquisitionRepository, cardLotRepository } from '../../data/repos';
import type { Acquisition } from '../../data/db';

export class AcquisitionService {
  /**
   * Create a new acquisition
   * @param acquisition - The acquisition data
   * @returns Promise<string> - The ID of the created acquisition
   */
  static async create(acquisition: Omit<Acquisition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const newAcquisition: Acquisition = {
      ...acquisition,
      id: `acq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await acquisitionRepository.add(newAcquisition);
  }
  
  /**
   * Get an acquisition by ID
   * @param id - The acquisition ID
   * @returns Promise<Acquisition | undefined> - The acquisition or undefined if not found
   */
  static async getById(id: string): Promise<Acquisition | undefined> {
    return await acquisitionRepository.getById(id);
  }
  
  /**
   * Get an acquisition by external reference
   * @param source - The source (e.g., 'manabox', 'cardmarket')
   * @param externalRef - The external reference
   * @returns Promise<Acquisition | undefined> - The acquisition or undefined if not found
   */
  static async getByExternalRef(source: string, externalRef: string): Promise<Acquisition | undefined> {
    return await acquisitionRepository.getByExternalRef(source, externalRef);
  }
  
  /**
   * Update an acquisition
   * @param id - The acquisition ID
   * @param patch - The partial acquisition data to update
   * @returns Promise<number> - The number of updated records
   */
  static async update(id: string, patch: Partial<Acquisition>): Promise<number> {
    return await acquisitionRepository.update(id, {
      ...patch,
      updatedAt: new Date()
    });
  }
  
  /**
   * Get all lots associated with an acquisition
   * @param acquisitionId - The acquisition ID
   * @returns Promise<CardLot[]> - The lots associated with the acquisition
   */
  static async getLots(acquisitionId: string) {
    return await cardLotRepository.getByAcquisitionId(acquisitionId);
  }
  
  /**
   * Get or create an acquisition by external reference
   * @param source - The source (e.g., 'manabox', 'cardmarket')
   * @param externalRef - The external reference
   * @param defaults - Default values for creation
   * @returns Promise<Acquisition> - The existing or newly created acquisition
   */
  static async getOrCreateByExternalRef(
    source: string,
    externalRef: string,
    defaults: Omit<Acquisition, 'id' | 'source' | 'externalRef' | 'createdAt' | 'updatedAt'>
  ): Promise<Acquisition> {
    let acquisition = await this.getByExternalRef(source, externalRef);
    
    if (!acquisition) {
      acquisition = {
        ...defaults,
        id: `acq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source,
        externalRef,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.create(acquisition);
    }
    
    return acquisition;
  }
}