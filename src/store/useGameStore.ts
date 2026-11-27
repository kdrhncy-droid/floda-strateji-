import { create } from 'zustand';
import { GameStoreState } from './storeTypes';
import { createCampaignAndTickSlice } from './slices/campaignAndTickSlice';
import { createMilitaryAndMovementSlice } from './slices/militaryAndMovementSlice';
import { createEconomyAndGovernanceSlice } from './slices/economyAndGovernanceSlice';
import { createDiplomacyAndWarSlice } from './slices/diplomacyAndWarSlice';

export type { GameStoreState } from './storeTypes';

export const useGameStore = create<GameStoreState>((set, get, api) => ({
  ...createCampaignAndTickSlice(set, get, api),
  ...createMilitaryAndMovementSlice(set, get, api),
  ...createEconomyAndGovernanceSlice(set, get, api),
  ...createDiplomacyAndWarSlice(set, get, api),
}));

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__GAME_STORE__ = useGameStore;
}
