import { formatGameDate } from '../../engine/simulationEngine';
import { pickEligibleCrisisEvent } from '../../engine/tickEngine';
import {
  assimilateTerritoryDomain,
  batchAssimilateDomain,
  batchStabilityFestivalDomain,
  batchUpgradeBuildingDomain,
  boostResearchDomain,
  cancelResearchDomain,
  changeIdeologyDomain,
  enactReformDomain,
  formEmpireDomain,
  investSpecialtyProductionDomain,
  resolveCrisisDomain,
  startMissionaryDomain,
  startResearchDomain,
  toggleAutoResearchDomain,
  unlockTechDomain,
  upgradeBuildingDomain,
} from '../../engine/empireAndArmyActions';
import { resolveSuccessionChoiceDomain } from '../../engine/dynastyAndSuccessionEngine';
import { recordTimelapseProgress } from '../../engine/timelapseEngine';
import { sound } from '../../utils/soundEngine';
import { GameStoreSlice, GameStoreState } from '../storeTypes';

type EconomyAndGovernanceSliceKeys =
  | 'activeCrisis'
  | 'activeSuccession'
  | 'resolveCrisis'
  | 'resolveSuccessionChoice'
  | 'triggerManualCabinetDecision'
  | 'upgradeBuilding'
  | 'investSpecialtyProduction'
  | 'assimilateTerritory'
  | 'batchAssimilate'
  | 'batchStabilityFestival'
  | 'batchUpgradeBuilding'
  | 'startMissionary'
  | 'formEmpire'
  | 'updateTaxRate'
  | 'updateBudget'
  | 'centralBankIntervention'
  | 'issueWarBonds'
  | 'changeIdeology'
  | 'startResearch'
  | 'cancelResearch'
  | 'boostResearch'
  | 'toggleAutoResearch'
  | 'unlockTech'
  | 'enactReform';

export const createEconomyAndGovernanceSlice: GameStoreSlice<
  Pick<GameStoreState, EconomyAndGovernanceSliceKeys>
> = (set, get) => ({
  activeCrisis: null,
  activeSuccession: null,

  resolveCrisis: (option) => set((s) => resolveCrisisDomain({ ...s, option })),

  resolveSuccessionChoice: (option) =>
    set((s) =>
      resolveSuccessionChoiceDomain({
        nations: s.nations,
        playerNationId: s.playerNationId,
        activeSuccession: s.activeSuccession,
        option,
        tick: s.tick,
        gameMode: s.gameMode,
        newsEvents: s.newsEvents,
        dateStr: formatGameDate(s.tick, s.gameMode),
      })
    ),

  triggerManualCabinetDecision: () =>
    set((s) => ({
      activeCrisis: pickEligibleCrisisEvent(s.gameMode),
      speed: 0,
    })),

  upgradeBuilding: (territoryId, building) =>
    set((s) =>
      upgradeBuildingDomain({
        territoryId,
        building,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  investSpecialtyProduction: (territoryIds, specialtyId) =>
    set((s) =>
      investSpecialtyProductionDomain({
        territoryIds,
        specialtyId,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  assimilateTerritory: (territoryId) =>
    set((s) =>
      assimilateTerritoryDomain({
        territoryId,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  batchAssimilate: () =>
    set((s) =>
      batchAssimilateDomain({
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  batchStabilityFestival: () =>
    set((s) =>
      batchStabilityFestivalDomain({
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  batchUpgradeBuilding: (building, territoryIds) =>
    set((s) =>
      batchUpgradeBuildingDomain({
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        building,
        territoryIds,
      })
    ),

  startMissionary: (territoryId) =>
    set((s) =>
      startMissionaryDomain({
        territoryId,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  formEmpire: (empireId) =>
    set((s) => {
      const patch = formEmpireDomain({
        empireId,
        nations: s.nations,
        territories: s.territories,
        playerNationId: s.playerNationId,
        tick: s.tick,
        gameMode: s.gameMode,
        newsEvents: s.newsEvents,
      });
      const nextNations = patch.nations || s.nations;
      const nextNews = patch.newsEvents || s.newsEvents;
      const nextTimelapse =
        patch.nations || patch.newsEvents
          ? recordTimelapseProgress(s.timelapse, {
              nextTick: s.tick,
              gameMode: s.gameMode,
              playerNationId: s.playerNationId,
              nations: nextNations,
              territories: s.territories,
              newsEvents: nextNews,
            })
          : s.timelapse;
      return {
        ...patch,
        timelapse: nextTimelapse,
      };
    }),

  updateTaxRate: (newRate) =>
    set((s) => ({
      nations: {
        ...s.nations,
        [s.playerNationId]: {
          ...s.nations[s.playerNationId],
          taxRate: newRate,
        },
      },
    })),

  updateBudget: (key, value) =>
    set((s) => ({
      nations: {
        ...s.nations,
        [s.playerNationId]: {
          ...s.nations[s.playerNationId],
          budget: {
            ...s.nations[s.playerNationId].budget,
            [key]: value,
          },
        },
      },
    })),

  centralBankIntervention: () => {
    const { nations, playerNationId } = get();
    const p = nations[playerNationId];
    if (!p) return;
    if (p.inflation < 3.5) {
      set({
        toastMessage:
          'Enflasyon zaten kontrol altında (%3.5 altı)! Ek müdahaleye gerek yok.',
      });
      return;
    }
    if (p.treasury < 800) {
      set({ toastMessage: 'Enflasyon müdahalesi için 800 Altın gerekli.' });
      return;
    }
    sound.playCoin();
    set({
      nations: {
        ...nations,
        [playerNationId]: {
          ...p,
          treasury: p.treasury - 800,
          inflation: Math.max(0.5, Number((p.inflation - 2.5).toFixed(2))),
          stability: Math.min(100, p.stability + 2),
        },
      },
      toastMessage:
        'Para Reformu & Sikke Tashihi uygulandı: Enflasyon -%2.5 düşürüldü (+2 İstikrar).',
    });
  },

  issueWarBonds: () => {
    const { nations, playerNationId } = get();
    const p = nations[playerNationId];
    if (!p) return;
    if (p.inflation >= 24) {
      set({
        toastMessage:
          'Yüksek enflasyon (%24+) nedeniyle yeni borç tahvili ihraç edilemez! Önce enflasyonu düşürün.',
      });
      return;
    }
    if (p.stability < 35) {
      set({
        toastMessage:
          'Düşük devlet istikrarı (%35 altı) nedeniyle borçlanma yapılamaz!',
      });
      return;
    }
    sound.playCoin();
    set({
      nations: {
        ...nations,
        [playerNationId]: {
          ...p,
          treasury: p.treasury + 850,
          inflation: Math.min(60, Number((p.inflation + 4.5).toFixed(2))),
          stability: Math.max(0, p.stability - 6),
        },
      },
      toastMessage:
        'Sefer Akçesi / Tahvil ihraç edildi: +850 Altın hazineye eklendi (+%4.5 Enflasyon, -6 İstikrar).',
    });
  },

  changeIdeology: (newIdeology) =>
    set((s) =>
      changeIdeologyDomain({
        newIdeology,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  startResearch: (techId) =>
    set((s) =>
      startResearchDomain({
        techId,
        nations: s.nations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
        tick: s.tick,
      })
    ),

  cancelResearch: () =>
    set((s) =>
      cancelResearchDomain({
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  boostResearch: () =>
    set((s) =>
      boostResearchDomain({
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  toggleAutoResearch: () =>
    set((s) =>
      toggleAutoResearchDomain({
        nations: s.nations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
        tick: s.tick,
      })
    ),

  unlockTech: (techId) =>
    set((s) =>
      unlockTechDomain({
        techId,
        nations: s.nations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
        tick: s.tick,
      })
    ),

  enactReform: (reformId) =>
    set((s) =>
      enactReformDomain({
        reformId,
        nations: s.nations,
        relations: s.relations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
      })
    ),
});
