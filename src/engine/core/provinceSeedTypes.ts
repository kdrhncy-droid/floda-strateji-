import { ResourceType } from '../../types/game';

/** Data contract for a country's curated province seeds (shared, cycle-free). */
export interface ProvinceSubSeed {
  suffixId: string;
  name: string;
  lon: number;
  lat: number;
  isCapital?: boolean;
  gdpShare: number;
  resource?: ResourceType;
  /**
   * Tier-3 province (ilçe / sancak) added on top of the original 448-province
   * map. Legacy seeds leave this undefined and keep the major-city tier.
   */
  isDistrict?: boolean;
  /** Period name shown by the 1444 scenario (Ayıntab, Saruhan, Echigo...). */
  historicName?: string;
}
