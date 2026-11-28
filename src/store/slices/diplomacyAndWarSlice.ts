import { DiplomaticEnvoy, GameScreenState, SpeedLevel } from '../../types/game';
import {
  callAllyToWarDomain,
  evaluateLandPurchaseDomain,
  executeDiplomaticActionDomain,
  issueProvinceUltimatumDomain,
  resolvePeaceConferenceDomain,
  resolvePeaceDealDomain,
  respondToDiplomaticOfferDomain,
} from '../../engine/diplomacyAndWarActions';
import { recordTimelapseProgress } from '../../engine/timelapseEngine';
import { sound } from '../../utils/soundEngine';
import {
  evaluateCampaignOutcome,
  GameStoreSlice,
  GameStoreState,
} from '../storeTypes';

type DiplomacyAndWarSliceKeys =
  | 'incomingDiplomaticOffer'
  | 'pendingWarDeclarationTargetId'
  | 'diplomaticEnvoys'
  | 'activeWarAnnouncement'
  | 'openWarDeclarationModal'
  | 'dismissWarAnnouncement'
  | 'cancelDiplomaticEnvoy'
  | 'confirmWarDeclaration'
  | 'diplomaticAction'
  | 'respondToDiplomaticOffer'
  | 'offerLandPurchase'
  | 'issueProvinceUltimatum'
  | 'peaceDeal'
  | 'callAllyToWar'
  | 'resolvePeaceConference';

export const createDiplomacyAndWarSlice: GameStoreSlice<
  Pick<GameStoreState, DiplomacyAndWarSliceKeys>
> = (set, get) => ({
  incomingDiplomaticOffer: null,
  pendingWarDeclarationTargetId: null,
  diplomaticEnvoys: [],
  activeWarAnnouncement: null,

  openWarDeclarationModal: (targetNationId) =>
    set({ pendingWarDeclarationTargetId: targetNationId }),

  dismissWarAnnouncement: () => set({ activeWarAnnouncement: null }),

  cancelDiplomaticEnvoy: (envoyId) =>
    set((s) => {
      const targetEnvoy = s.diplomaticEnvoys.find((e) => e.id === envoyId);
      if (!targetEnvoy) return {};
      const targetName = s.nations[targetEnvoy.targetNationId]?.name || 'Ülke';
      sound.playClick();
      return {
        diplomaticEnvoys: s.diplomaticEnvoys.filter((e) => e.id !== envoyId),
        toastMessage: `${targetName} elçilik görevi iptal edildi.`,
      };
    }),

  confirmWarDeclaration: (targetNationId, calledAllyIds) => {
    const s = get();
    const totalPlayerGarrison = Object.values(s.territories)
      .filter((t) => t.ownerId === s.playerNationId)
      .reduce((sum, t) => sum + t.garrison, 0);

    const patch = executeDiplomaticActionDomain({
      targetNationId,
      action: 'DECLARE_WAR',
      playerNationId: s.playerNationId,
      totalPlayerGarrison,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      movements: s.movements,
      newsEvents: s.newsEvents,
      calledAllyIds,
    });

    set({
      pendingWarDeclarationTargetId: null,
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.wars ? { wars: patch.wars } : {}),
      ...(patch.movements ? { movements: patch.movements } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.warAnnouncement
        ? { activeWarAnnouncement: patch.warAnnouncement }
        : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
    });
  },

  diplomaticAction: (targetNationId, action) => {
    if (action === 'DECLARE_WAR') {
      sound.playClick();
      set({ pendingWarDeclarationTargetId: targetNationId });
      return;
    }
    const s = get();
    const isEnvoyMission = action === 'IMPROVE' || action === 'DAMAGE';
    if (
      isEnvoyMission &&
      s.diplomaticEnvoys.length >= 3 &&
      !s.diplomaticEnvoys.some((e) => e.targetNationId === targetNationId)
    ) {
      sound.playClick();
      set({
        toastMessage:
          'Aynı anda en fazla 3 diplomatik elçilik görevi yürütebilirsiniz. Önce bir elçiliği kapatın.',
      });
      return;
    }

    const totalPlayerGarrison = Object.values(s.territories)
      .filter((t) => t.ownerId === s.playerNationId)
      .reduce((sum, t) => sum + t.garrison, 0);

    const patch = executeDiplomaticActionDomain({
      targetNationId,
      action,
      playerNationId: s.playerNationId,
      totalPlayerGarrison,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      movements: s.movements,
      newsEvents: s.newsEvents,
    });

    let nextEnvoys = s.diplomaticEnvoys;
    if (patch.startEnvoy) {
      const envoy: DiplomaticEnvoy = {
        ...patch.startEnvoy,
        id: `envoy_${patch.startEnvoy.targetNationId}_${Date.now()}`,
        startedTick: s.tick,
      };
      nextEnvoys = [
        ...s.diplomaticEnvoys.filter(
          (e) => e.targetNationId !== patch.startEnvoy!.targetNationId
        ),
        envoy,
      ];
    }

    set({
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.wars ? { wars: patch.wars } : {}),
      ...(patch.movements ? { movements: patch.movements } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.startEnvoy ? { diplomaticEnvoys: nextEnvoys } : {}),
      ...(patch.warAnnouncement
        ? { activeWarAnnouncement: patch.warAnnouncement }
        : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
    });
  },

  respondToDiplomaticOffer: (accept) => {
    const s = get();
    if (!s.incomingDiplomaticOffer) return;
    const patch = respondToDiplomaticOfferDomain({
      offer: s.incomingDiplomaticOffer,
      accept,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      relations: s.relations,
      wars: s.wars,
      newsEvents: s.newsEvents,
    });
    set({
      incomingDiplomaticOffer: null,
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
    });
  },

  offerLandPurchase: (territoryId) => {
    const s = get();
    const patch = evaluateLandPurchaseDomain({
      territoryId,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      newsEvents: s.newsEvents,
    });
    const nextTerritories = patch.territories || s.territories;
    const outcome = evaluateCampaignOutcome(
      nextTerritories,
      s.playerNationId,
      s.dismissedVictoryBanner
    );
    set({
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
      ...(outcome
        ? {
            campaignOutcome: outcome,
            screenState: 'VICTORY_SUMMARY' as GameScreenState,
            speed: 0 as SpeedLevel,
          }
        : {}),
    });
  },

  issueProvinceUltimatum: (territoryId) => {
    const s = get();
    const patch = issueProvinceUltimatumDomain({
      territoryId,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      newsEvents: s.newsEvents,
    });
    const nextTerritories = patch.territories || s.territories;
    const outcome = evaluateCampaignOutcome(
      nextTerritories,
      s.playerNationId,
      s.dismissedVictoryBanner
    );
    set({
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
      ...(outcome
        ? {
            campaignOutcome: outcome,
            screenState: 'VICTORY_SUMMARY' as GameScreenState,
            speed: 0 as SpeedLevel,
          }
        : {}),
    });
  },

  peaceDeal: (warId, dealType) => {
    const s = get();
    const patch = resolvePeaceDealDomain({
      warId,
      dealType,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      movements: s.movements,
      battles: s.battles,
      newsEvents: s.newsEvents,
    });

    const nextTerritories = patch.territories || s.territories;
    const outcome = evaluateCampaignOutcome(
      nextTerritories,
      s.playerNationId,
      s.dismissedVictoryBanner
    );

    set({
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.wars ? { wars: patch.wars } : {}),
      ...(patch.movements ? { movements: patch.movements } : {}),
      ...(patch.battles ? { battles: patch.battles } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.warAnnouncement
        ? { activeWarAnnouncement: patch.warAnnouncement }
        : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
      ...(patch.wars ? { activeWarModalId: null } : {}),
      timelapse: recordTimelapseProgress(s.timelapse, {
        nextTick: s.tick,
        gameMode: s.gameMode,
        playerNationId: s.playerNationId,
        nations: patch.nations || s.nations,
        territories: nextTerritories,
        newsEvents: patch.newsEvents || s.newsEvents,
      }),
      ...(outcome
        ? {
            campaignOutcome: outcome,
            screenState: 'VICTORY_SUMMARY' as GameScreenState,
            speed: 0 as SpeedLevel,
          }
        : {}),
    });
  },

  callAllyToWar: (warId, allyNationId) => {
    const s = get();
    const patch = callAllyToWarDomain({
      warId,
      allyNationId,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      relations: s.relations,
      wars: s.wars,
      newsEvents: s.newsEvents,
    });
    set({
      ...(patch.wars ? { wars: patch.wars } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
    });
  },

  resolvePeaceConference: (request) => {
    const s = get();
    const patch = resolvePeaceConferenceDomain({
      request,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      movements: s.movements,
      battles: s.battles,
      newsEvents: s.newsEvents,
    });

    const nextTerritories = patch.territories || s.territories;
    const outcome = evaluateCampaignOutcome(
      nextTerritories,
      s.playerNationId,
      s.dismissedVictoryBanner
    );

    set({
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.relations ? { relations: patch.relations } : {}),
      ...(patch.wars ? { wars: patch.wars, activeWarModalId: null } : {}),
      ...(patch.movements ? { movements: patch.movements } : {}),
      ...(patch.battles ? { battles: patch.battles } : {}),
      ...(patch.newsEvents ? { newsEvents: patch.newsEvents } : {}),
      ...(patch.warAnnouncement
        ? { activeWarAnnouncement: patch.warAnnouncement }
        : {}),
      ...(patch.toast ? { toastMessage: patch.toast } : {}),
      timelapse: recordTimelapseProgress(s.timelapse, {
        nextTick: s.tick,
        gameMode: s.gameMode,
        playerNationId: s.playerNationId,
        nations: patch.nations || s.nations,
        territories: nextTerritories,
        newsEvents: patch.newsEvents || s.newsEvents,
      }),
      ...(outcome
        ? {
            campaignOutcome: outcome,
            screenState: 'VICTORY_SUMMARY' as GameScreenState,
            speed: 0 as SpeedLevel,
          }
        : {}),
    });
  },
});
