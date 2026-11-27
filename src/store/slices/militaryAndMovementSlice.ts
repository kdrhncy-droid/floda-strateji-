import {
  ActiveBattle,
  GameScreenState,
  SpeedLevel,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import { COMMANDERS } from '../../data/world2026Data';
import { formatGameDate } from '../../engine/simulationEngine';
import {
  bestowFavorOnLordDomain,
  getLordRetinueTroops,
  withUpdatedLordLoyalty,
} from '../../engine/pashaAndFiefEngine';
import { scaleUnits } from '../../engine/tickEngine';
import { executeWartimeTradeRaidDomain } from '../../engine/straitsAndTradeEngine';
import {
  batchBorderMobilizationDomain,
  batchRecruitUnitsDomain,
  disbandArmyDomain,
  disbandSeaArmyDomain,
  executeArmyMoveDomain,
  executeBatchArmyMoveDomain,
  executeDisembarkFromSeaDomain,
  executeEmbarkToSeaDomain,
  hireMercenaryDomain,
  launchNuclearStrikeDomain,
  mergeNeighborArmiesDomain,
  modernizeNationalArmyDomain,
  recruitOrAssignGeneralDomain,
  recruitUnitDomain,
  siegeBombardmentDomain,
} from '../../engine/empireAndArmyActions';
import { evaluatePlayerAiCommander } from '../../engine/playerAiCommander';
import { resolveTacticalBattleOutcomeDomain } from '../../engine/diplomacyAndWarActions';
import { sound } from '../../utils/soundEngine';
import {
  evaluateCampaignOutcome,
  GameStoreSlice,
  GameStoreState,
} from '../storeTypes';

type MilitaryAndMovementSliceKeys =
  | 'pendingWarMove'
  | 'aiCommanderEnabled'
  | 'aiCommanderStance'
  | 'activeTacticalBattle'
  | 'recentRecruitFeedback'
  | 'setPendingWarMove'
  | 'confirmPendingWarMove'
  | 'toggleAiCommander'
  | 'setAiCommanderStance'
  | 'applyTacticalOrder'
  | 'recruitUnit'
  | 'hireMercenary'
  | 'launchNuclearStrike'
  | 'recruitOrAssignGeneral'
  | 'batchBorderMobilization'
  | 'batchRecruitUnits'
  | 'executeArmyMove'
  | 'executeBatchArmyMove'
  | 'executeEmbarkToSea'
  | 'executeDisembarkFromSea'
  | 'disbandSeaArmy'
  | 'mergeNeighborArmies'
  | 'disbandArmy'
  | 'modernizeNationalArmy'
  | 'assignFiefLord'
  | 'bestowFavorOnLord'
  | 'toggleCallLordToBanner'
  | 'siegeBombardment'
  | 'raidEnemyTradeRoutes'
  | 'applyBattleOutcome';

export const createMilitaryAndMovementSlice: GameStoreSlice<
  Pick<GameStoreState, MilitaryAndMovementSliceKeys>
> = (set, get) => ({
  pendingWarMove: null,
  aiCommanderEnabled: false,
  aiCommanderStance: 'BALANCED',
  activeTacticalBattle: null,
  recentRecruitFeedback: null,

  setPendingWarMove: (pendingWarMove) => set({ pendingWarMove }),

  confirmPendingWarMove: () =>
    set((s) => {
      if (!s.pendingWarMove) return {};
      const sourceIds = s.pendingWarMove.sourceTerritoryIds;
      const sourceSeaArmyId = s.pendingWarMove.sourceSeaArmyId;
      const patch = sourceSeaArmyId
        ? executeDisembarkFromSeaDomain({
            ...s,
            sourceSeaArmyId,
            toTerritoryId: s.pendingWarMove.toId,
            moveRatio: s.pendingWarMove.moveRatio ?? s.moveRatio,
            forceDeclareWar: true,
          })
        : sourceIds && sourceIds.length > 0
        ? executeBatchArmyMoveDomain({
            ...s,
            sourceIds,
            moveRatio: s.pendingWarMove.moveRatio ?? s.moveRatio,
            toId: s.pendingWarMove.toId,
            forceDeclareWar: true,
          })
        : executeArmyMoveDomain({
            ...s,
            fromId: s.pendingWarMove.fromId,
            toId: s.pendingWarMove.toId,
            forceDeclareWar: true,
          });
      return {
        ...patch,
        pendingWarMove: null,
        moveRatio: 1,
        ...(patch.warAnnouncement
          ? { activeWarAnnouncement: patch.warAnnouncement }
          : {}),
        ...(patch.movements && s.speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      };
    }),

  toggleAiCommander: () =>
    set((s) => {
      const nextEnabled = !s.aiCommanderEnabled;
      sound.playClick();
      if (!nextEnabled) {
        return {
          aiCommanderEnabled: false,
          toastMessage:
            'Yapay Zekâ Komutanı kapatıldı; ordu kontrolü tamamen sizde.',
        };
      }
      const inWar = s.wars.some(
        (w) =>
          w.attackerId === s.playerNationId ||
          w.defenderId === s.playerNationId ||
          w.attackers.includes(s.playerNationId) ||
          w.defenders.includes(s.playerNationId)
      );
      if (!inWar) {
        return {
          aiCommanderEnabled: true,
          toastMessage:
            '🤖 Yapay Zekâ Komutanı hazır! Barıştasınız — yeni bir savaşta savunma ve taarruzu otomatik yönetecek.',
        };
      }
      const immediateRes = evaluatePlayerAiCommander({
        tick: s.tick,
        playerNationId: s.playerNationId,
        nations: s.nations,
        territories: s.territories,
        relations: s.relations,
        wars: s.wars,
        battles: s.battles,
        movements: s.movements,
        stance: s.aiCommanderStance,
      });
      if (immediateRes) {
        sound.playMarch();
        return {
          aiCommanderEnabled: true,
          territories: immediateRes.updatedTerritories,
          movements: [...s.movements, ...immediateRes.newMovements],
          toastMessage:
            immediateRes.summaryToast ||
            '🤖 Yapay Zekâ Komutanı aktif! Savaş cepheleri devralındı.',
        };
      }
      return {
        aiCommanderEnabled: true,
        toastMessage:
          '🤖 Yapay Zekâ Komutanı aktif! Uygun cephe fırsatı oluştuğunda birlikleri otomatik yönetecek.',
      };
    }),

  setAiCommanderStance: (stance) =>
    set((s) => {
      sound.playClick();
      const stanceName =
        stance === 'AGGRESSIVE'
          ? 'Taarruz Duruşu (Agresif İlerleyiş)'
          : stance === 'DEFENSIVE'
          ? 'Savunma Duruşu (Güçlü Garnizon & Kuşatma Kurtarma)'
          : 'Dengeli Duruş (Standart Strateji)';
      return {
        aiCommanderStance: stance,
        toastMessage: s.aiCommanderEnabled
          ? `🤖 YZ Cephe Duruşu güncellendi: ${stanceName}`
          : `🤖 YZ Cephe Duruşu seçildi: ${stanceName}`,
      };
    }),

  applyTacticalOrder: (territoryId, tactic) =>
    set((s) => {
      const btlIdx = s.battles.findIndex((b) => b.territoryId === territoryId);
      const terr = s.territories[territoryId];
      if (btlIdx === -1 && (!terr || !terr.siege)) return {};

      if (btlIdx === -1 && tactic === 'BOMBARD' && terr?.siege) {
        if (terr.siege.attackerId !== s.playerNationId) {
          return {
            toastMessage:
              'Sur bombardımanı yalnız kuşatmacı tarafından emredilebilir.',
          };
        }
        const wallBefore = Math.max(
          0,
          Math.min(100, terr.castleWallHp ?? terr.siege.wallIntegrity ?? 100)
        );
        if (wallBefore <= 0) {
          return {
            toastMessage: `${terr.name} surları zaten yıkılmış durumda.`,
          };
        }
        const wallAfter = Math.max(0, wallBefore - 20);
        return {
          territories: {
            ...s.territories,
            [territoryId]: {
              ...terr,
              castleWallHp: wallAfter,
              siege: { ...terr.siege, wallIntegrity: wallAfter },
            },
          },
          toastMessage: `${terr.name} surları bombardımanla %${wallBefore} → %${wallAfter} düştü.`,
        };
      }

      if (btlIdx === -1 || !terr) return {};

      const btl = s.battles[btlIdx];
      const isAttacker = btl.attackerId === s.playerNationId;
      const isDefender = btl.defenderId === s.playerNationId;
      if (!isAttacker && !isDefender) {
        return {
          toastMessage:
            'Bu muharebede taraf olmadığınız için komut veremezsiniz.',
        };
      }

      const normalizeBattleUnits = (
        units: ActiveBattle['attackerUnits'],
        troopCount: number
      ) => {
        if (troopCount <= 0) return { infantry: 0, armor: 0, airDrone: 0 };
        const unitTotal = units.infantry + units.armor + units.airDrone;
        return unitTotal > 0
          ? scaleUnits(units, troopCount / unitTotal)
          : { infantry: troopCount, armor: 0, airDrone: 0 };
      };

      if (tactic === 'RETREAT') {
        const survivingTroops = isAttacker
          ? btl.attackerTroops
          : btl.defenderTroops;
        const survivingUnits = normalizeBattleUnits(
          isAttacker ? btl.attackerUnits : btl.defenderUnits,
          survivingTroops
        );
        const candidateIds = Array.from(
          new Set([
            ...(isAttacker && btl.fromTerritoryId ? [btl.fromTerritoryId] : []),
            ...terr.neighbors,
          ])
        ).filter((id) => id !== territoryId);
        const fallbackTerr = candidateIds
          .map((id) => s.territories[id])
          .find((candidate) => candidate?.ownerId === s.playerNationId);
        if (survivingTroops > 0 && !fallbackTerr) {
          return {
            toastMessage:
              'Dost eyalete güvenli geri çekilme yolu yok; muharebe devam ediyor.',
          };
        }

        const updatedBattles = s.battles.filter((_, idx) => idx !== btlIdx);
        const updatedTerritories: Record<string, Territory> = {
          ...s.territories,
        };
        if (fallbackTerr && survivingTroops > 0) {
          const stationedUnits = fallbackTerr.units || {
            infantry: fallbackTerr.garrison,
            armor: 0,
            airDrone: 0,
          };
          updatedTerritories[fallbackTerr.id] = {
            ...fallbackTerr,
            garrison: fallbackTerr.garrison + survivingTroops,
            units: {
              infantry: stationedUnits.infantry + survivingUnits.infantry,
              armor: stationedUnits.armor + survivingUnits.armor,
              airDrone: stationedUnits.airDrone + survivingUnits.airDrone,
            },
          };
        }

        let updatedNations = s.nations;
        if (!isAttacker) {
          const attackerSurvivors = Math.max(0, btl.attackerTroops);
          const occupyingUnits = normalizeBattleUnits(
            btl.attackerUnits,
            attackerSurvivors
          );
          updatedTerritories[territoryId] = {
            ...terr,
            ownerId: attackerSurvivors > 0 ? btl.attackerId : terr.ownerId,
            isOccupied: attackerSurvivors > 0,
            occupiedById: attackerSurvivors > 0 ? btl.attackerId : undefined,
            isCapital: attackerSurvivors > 0 ? false : terr.isCapital,
            garrison: attackerSurvivors,
            units: occupyingUnits,
          };

          const playerNation = s.nations[s.playerNationId];
          if (
            attackerSurvivors > 0 &&
            playerNation?.capitalTerritoryId === territoryId
          ) {
            const remainingTerritories = Object.values(s.territories).filter(
              (candidate) =>
                candidate.id !== territoryId &&
                candidate.ownerId === s.playerNationId
            );
            updatedNations = {
              ...s.nations,
              [s.playerNationId]:
                remainingTerritories.length > 0
                  ? {
                      ...playerNation,
                      capitalTerritoryId: remainingTerritories[0].id,
                    }
                  : { ...playerNation, isEliminated: true },
            };
            if (remainingTerritories.length > 0) {
              const nextCapital = remainingTerritories[0];
              updatedTerritories[nextCapital.id] = {
                ...updatedTerritories[nextCapital.id],
                isCapital: true,
              };
            }
          }
        }

        const outcomeDecided = isAttacker || btl.attackerTroops > 0;
        const updatedWars = s.wars.map((war) => {
          const involvesBoth =
            (war.attackers.includes(btl.attackerId) &&
              war.defenders.includes(btl.defenderId)) ||
            (war.attackers.includes(btl.defenderId) &&
              war.defenders.includes(btl.attackerId));
          if (!involvesBoth) return war;
          const attackerSide = war.attackers.includes(btl.attackerId);
          const attackerWon = !isAttacker;
          const scoreDelta = outcomeDecided
            ? attackerWon === attackerSide
              ? 28
              : -28
            : 0;
          const attackerLosses = Math.max(
            0,
            (btl.attackerInitialTroops ?? btl.attackerTroops) - btl.attackerTroops
          );
          const defenderLosses = Math.max(
            0,
            (btl.defenderInitialTroops ?? btl.defenderTroops) - btl.defenderTroops
          );
          return {
            ...war,
            attackerWarScore: Math.max(
              -100,
              Math.min(100, (war.attackerWarScore ?? 0) + scoreDelta)
            ),
            casualtiesAttacker:
              (war.casualtiesAttacker ?? 0) +
              (attackerSide ? attackerLosses : defenderLosses),
            casualtiesDefender:
              (war.casualtiesDefender ?? 0) +
              (attackerSide ? defenderLosses : attackerLosses),
          };
        });

        const destinationText = fallbackTerr
          ? `${fallbackTerr.name} eyaletine`
          : 'dost topraklara';
        const toastMessage = isAttacker
          ? `Ordumuz ${terr.name} muharebesinden ${destinationText} ${survivingTroops.toLocaleString('tr-TR')} askerle çekildi.`
          : btl.attackerTroops > 0
          ? `Savunma hattı terk edildi; ${terr.name} eyaleti ${s.nations[btl.attackerId]?.name || 'düşman'} tarafından işgal edildi. ${survivingTroops.toLocaleString('tr-TR')} savunmacı ${destinationText} çekildi.`
          : `Savunma birlikleri ${destinationText} çekildi; düşman kuvveti kalmadı.`;

        const retreatOutcome = evaluateCampaignOutcome(
          updatedTerritories,
          s.playerNationId,
          s.dismissedVictoryBanner
        );

        return {
          battles: updatedBattles,
          wars: updatedWars,
          nations: updatedNations,
          territories: updatedTerritories,
          activeBattleOverviewTerritoryId: null,
          toastMessage,
          ...(retreatOutcome
            ? {
                campaignOutcome: retreatOutcome,
                screenState: 'VICTORY_SUMMARY' as GameScreenState,
                speed: 0 as SpeedLevel,
              }
            : {}),
        };
      }

      if (tactic === 'TURAN') {
        const alreadyUsed = isAttacker
          ? Boolean(btl.attackerTuranUsed)
          : Boolean(btl.defenderTuranUsed);
        if (alreadyUsed) {
          return {
            toastMessage:
              'Hilal & Turan taktiği bu muharebede zaten kullanıldı.',
          };
        }
        const updatedBattles = [...s.battles];
        updatedBattles[btlIdx] = {
          ...btl,
          attackerTuranUsed: isAttacker ? true : btl.attackerTuranUsed,
          defenderTuranUsed: isDefender ? true : btl.defenderTuranUsed,
          attackerTuranPowerBonus: isAttacker ? 18 : btl.attackerTuranPowerBonus,
          defenderTuranPowerBonus: isDefender ? 18 : btl.defenderTuranPowerBonus,
        };
        return {
          battles: updatedBattles,
          toastMessage:
            'Hilal & Turan taktiği hazır: bir sonraki muharebe raundunda +%18 güç sağlar.',
        };
      }

      if (tactic === 'BOMBARD') {
        const enemyTroops = isAttacker ? btl.defenderTroops : btl.attackerTroops;
        const hit = Math.max(
          0,
          Math.min(Math.max(0, enemyTroops - 200), Math.round(enemyTroops * 0.15))
        );
        const remainingTroops = Math.max(0, enemyTroops - hit);
        const enemyUnits = isAttacker ? btl.defenderUnits : btl.attackerUnits;
        const remainingUnits = scaleUnits(
          enemyUnits,
          remainingTroops / Math.max(1, enemyTroops)
        );
        const updatedBattles = [...s.battles];
        updatedBattles[btlIdx] = {
          ...btl,
          attackerTroops: isAttacker ? btl.attackerTroops : remainingTroops,
          attackerUnits: isAttacker ? btl.attackerUnits : remainingUnits,
          defenderTroops: isAttacker ? remainingTroops : btl.defenderTroops,
          defenderUnits: isAttacker ? remainingUnits : btl.defenderUnits,
        };
        return {
          battles: updatedBattles,
          toastMessage:
            hit > 0
              ? `Topçu ateşi düşman kuvvetlerine ${hit.toLocaleString('tr-TR')} asker kayıp verdirdi.`
              : 'Düşman kuvveti 200 asker tabanında; bombardıman ek kayıp vermedi.',
        };
      }

      return {};
    }),

  recruitUnit: (territoryId, unitType, amount, baseGoldCost) =>
    set((s) => {
      const patch = recruitUnitDomain({
        territoryId,
        unitType,
        amount,
        baseGoldCost,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        tick: s.tick,
      });
      return {
        ...patch,
        ...(patch.recruitFeedback
          ? { recentRecruitFeedback: patch.recruitFeedback }
          : {}),
      };
    }),

  hireMercenary: (territoryId, companyId) =>
    set((s) => {
      const patch = hireMercenaryDomain({
        territoryId,
        companyId,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
        tick: s.tick,
      });
      return {
        ...patch,
        ...(patch.recruitFeedback
          ? { recentRecruitFeedback: patch.recruitFeedback }
          : {}),
      };
    }),

  launchNuclearStrike: (territoryId) =>
    set((s) => {
      const patch = launchNuclearStrikeDomain({
        territoryId,
        territories: s.territories,
        nations: s.nations,
        relations: s.relations,
        wars: s.wars,
        playerNationId: s.playerNationId,
        tick: s.tick,
        gameMode: s.gameMode,
        newsEvents: s.newsEvents,
      });
      return {
        ...patch,
        ...(patch.warAnnouncement
          ? { activeWarAnnouncement: patch.warAnnouncement }
          : {}),
      };
    }),

  recruitOrAssignGeneral: (generalId) =>
    set((s) =>
      recruitOrAssignGeneralDomain({
        generalId,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  batchBorderMobilization: () =>
    set((s) => {
      const patch = batchBorderMobilizationDomain({
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        tick: s.tick,
      });
      return {
        ...patch,
        ...(patch.recruitFeedback
          ? { recentRecruitFeedback: patch.recruitFeedback }
          : {}),
      };
    }),

  batchRecruitUnits: (scope, unitMode = 'MIXED', territoryId, roundsPerCity = 1) =>
    set((s) => {
      const patch = batchRecruitUnitsDomain({
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        scope,
        unitMode,
        territoryId: territoryId || s.selectedTerritoryId || undefined,
        roundsPerCity,
        gameMode: s.gameMode,
        tick: s.tick,
      });
      return {
        ...patch,
        ...(patch.recruitFeedback
          ? { recentRecruitFeedback: patch.recruitFeedback }
          : {}),
      };
    }),

  executeArmyMove: (fromId, toId) =>
    set((s) => {
      const patch = executeArmyMoveDomain({ ...s, fromId, toId });
      return {
        ...patch,
        ...(patch.warAnnouncement
          ? { activeWarAnnouncement: patch.warAnnouncement }
          : {}),
        ...(patch.movements ? { moveRatio: 1 } : {}),
        ...(patch.movements && s.speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      };
    }),

  executeBatchArmyMove: (sourceIds, toId, ratioOverride) =>
    set((s) => {
      const patch = executeBatchArmyMoveDomain({
        ...s,
        sourceIds,
        toId,
        moveRatio: ratioOverride ?? s.moveRatio,
      });
      return {
        ...patch,
        ...(patch.warAnnouncement
          ? { activeWarAnnouncement: patch.warAnnouncement }
          : {}),
        ...(patch.movements ? { moveRatio: 1 } : {}),
        ...(patch.movements && s.speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      };
    }),

  executeEmbarkToSea: (targetCoords, targetSeaArmyId = null) =>
    set((s) => {
      const patch = executeEmbarkToSeaDomain({
        sourceTerritoryId: s.armyOrderSourceId,
        sourceSeaArmyId: s.seaArmyOrderSourceId,
        targetCoords,
        targetSeaArmyId,
        territories: s.territories,
        nations: s.nations,
        movements: s.movements,
        seaArmies: s.seaArmies,
        playerNationId: s.playerNationId,
        moveRatio: s.moveRatio,
        speed: s.speed,
      });
      return {
        ...patch,
        ...(patch.movements ? { moveRatio: 1 } : {}),
        ...(patch.movements && s.speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      };
    }),

  executeDisembarkFromSea: (sourceSeaArmyId, toTerritoryId) =>
    set((s) => {
      const patch = executeDisembarkFromSeaDomain({
        sourceSeaArmyId,
        toTerritoryId,
        territories: s.territories,
        nations: s.nations,
        relations: s.relations,
        wars: s.wars,
        movements: s.movements,
        seaArmies: s.seaArmies,
        playerNationId: s.playerNationId,
        moveRatio: s.moveRatio,
        tick: s.tick,
        gameMode: s.gameMode,
        newsEvents: s.newsEvents,
        speed: s.speed,
      });
      return {
        ...patch,
        ...(patch.warAnnouncement
          ? { activeWarAnnouncement: patch.warAnnouncement }
          : {}),
        ...(patch.movements ? { moveRatio: 1 } : {}),
        ...(patch.movements && s.speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      };
    }),

  disbandSeaArmy: (seaArmyId, ratio) =>
    set((s) => {
      const patch = disbandSeaArmyDomain({
        seaArmyId,
        ratio,
        seaArmies: s.seaArmies,
        nations: s.nations,
        playerNationId: s.playerNationId,
      });
      const cleanedPatch = { ...patch };
      if (cleanedPatch.seaArmyOrderSourceId === undefined) {
        delete cleanedPatch.seaArmyOrderSourceId;
      }
      return cleanedPatch;
    }),

  mergeNeighborArmies: (targetTerritoryId) =>
    set((s) =>
      mergeNeighborArmiesDomain({
        targetTerritoryId,
        territories: s.territories,
        wars: s.wars,
        battles: s.battles,
        movements: s.movements,
        playerNationId: s.playerNationId,
        speed: s.speed,
      })
    ),

  disbandArmy: (territoryId, ratio) =>
    set((s) =>
      disbandArmyDomain({
        territoryId,
        ratio,
        territories: s.territories,
        nations: s.nations,
        battles: s.battles,
        playerNationId: s.playerNationId,
      })
    ),

  modernizeNationalArmy: () => set((s) => modernizeNationalArmyDomain(s)),

  assignFiefLord: (territoryId, lordId) => {
    const { territories, nations, playerNationId } = get();
    const t = territories[territoryId];
    const p = nations[playerNationId];
    if (!t || !p || t.ownerId !== playerNationId) return;

    const prevLordId = t.fiefLordId || null;
    if (prevLordId === lordId) return;

    sound.playTreaty();
    let updatedPlayerNation = p;
    if (prevLordId) {
      updatedPlayerNation = withUpdatedLordLoyalty(
        updatedPlayerNation,
        prevLordId,
        -22
      );
    }

    if (!lordId) {
      const prevCmd = prevLordId
        ? COMMANDERS.find((c) => c.id === prevLordId)
        : null;
      set({
        nations: {
          ...nations,
          [playerNationId]: updatedPlayerNation,
        },
        territories: {
          ...territories,
          [territoryId]: { ...t, fiefLordId: undefined },
        },
        toastMessage: prevCmd
          ? `${t.name} doğrudan merkeze bağlandı (${prevCmd.name} Sadakati -22 düştü!).`
          : `${t.name} doğrudan Merkez Hükümet yönetimine alındı.`,
      });
      return;
    }

    updatedPlayerNation = withUpdatedLordLoyalty(
      updatedPlayerNation,
      lordId,
      12
    );
    const lord = COMMANDERS.find((c) => c.id === lordId);
    set({
      nations: {
        ...nations,
        [playerNationId]: updatedPlayerNation,
      },
      territories: {
        ...territories,
        [territoryId]: {
          ...t,
          fiefLordId: lordId,
          garrison: t.garrison + 1500,
          units: {
            ...t.units,
            infantry: (t.units?.infantry || t.garrison) + 1500,
          },
        },
      },
      toastMessage: `${t.name} Tımarı ${lord?.name} komutasına verildi! (+12 Sadakat, +1.500 Muhafız yerleşti)`,
    });
  },

  bestowFavorOnLord: (lordId) =>
    set((s) =>
      bestowFavorOnLordDomain({
        lordId,
        nations: s.nations,
        playerNationId: s.playerNationId,
      })
    ),

  toggleCallLordToBanner: (lordId) => {
    const { nations, territories, playerNationId } = get();
    const p = nations[playerNationId];
    const lord = COMMANDERS.find((c) => c.id === lordId);
    if (!p || !lord) return;

    const currentCalled = p.bannerCalledLordIds || [];
    if (currentCalled.includes(lordId)) {
      sound.playClick();
      set({
        nations: {
          ...nations,
          [playerNationId]: {
            ...p,
            bannerCalledLordIds: currentCalled.filter((id) => id !== lordId),
          },
        },
        toastMessage: `${lord.name} sancak ordugahından kendi tımarına döndü.`,
      });
      return;
    }

    if ((p.clanInfluence ?? 0) < 35) {
      set({
        toastMessage:
          'Lordu Sancağa çağırmak için 35 ⚜ Klan Nüfuzu gerekli.',
      });
      return;
    }

    sound.playWarHorn();
    const retinue = getLordRetinueTroops(lordId, territories);
    set({
      nations: {
        ...nations,
        [playerNationId]: {
          ...p,
          clanInfluence: Math.max(0, (p.clanInfluence || 0) - 35),
          bannerCalledLordIds: [...currentCalled, lordId],
        },
      },
      toastMessage: `${lord.name} (+${retinue.toLocaleString('tr-TR')} Muhafız) Sancak Ordugahına katıldı! Taarruzlarınızda sizinle yürüyecek.`,
    });
  },

  siegeBombardment: (territoryId, method) =>
    set((s) =>
      siegeBombardmentDomain({
        territoryId,
        method,
        territories: s.territories,
        nations: s.nations,
        playerNationId: s.playerNationId,
        gameMode: s.gameMode,
      })
    ),

  raidEnemyTradeRoutes: () => {
    const s = get();
    const res = executeWartimeTradeRaidDomain({
      playerNationId: s.playerNationId,
      gameMode: s.gameMode,
      tick: s.tick,
      nations: s.nations,
      territories: s.territories,
      wars: s.wars,
    });
    if (!res.ok) {
      sound.playClick();
      set({ toastMessage: res.toastMessage });
      return;
    }
    sound.playMarch();
    const nextNews: WorldNewsEvent[] = [
      {
        id: `raid_${s.tick}_${Math.random().toString(36).slice(2, 7)}`,
        tick: s.tick,
        dateStr: formatGameDate(s.tick, s.gameMode),
        title: `🏴‍☠️ Ticaret Hattı Baskını (+${res.plunderedGold} Altın)`,
        description: `Akıncı ve donanma müfrezelerimiz ${res.targetNationName} kontrolündeki (${res.corridorName}) hattını vurarak +${res.plunderedGold} Altın ganimet ele geçirdi!`,
        type: 'WAR',
      },
      ...s.newsEvents.slice(0, 39),
    ];
    set({
      nations: res.nations,
      territories: res.territories,
      newsEvents: nextNews,
      toastMessage: res.toastMessage,
    });
  },

  applyBattleOutcome: (finalBattle) => {
    const s = get();
    const patch = resolveTacticalBattleOutcomeDomain({
      finalBattle,
      playerNationId: s.playerNationId,
      tick: s.tick,
      gameMode: s.gameMode,
      nations: s.nations,
      territories: s.territories,
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
      activeTacticalBattle: null,
      ...(patch.nations ? { nations: patch.nations } : {}),
      ...(patch.territories ? { territories: patch.territories } : {}),
      ...(patch.wars ? { wars: patch.wars } : {}),
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
});
