import {
  ActiveWar,
  AiPersonality,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  IncomingDiplomaticOffer,
  Nation,
  TacticalBattleState,
  Territory,
  WorldNewsEvent,
} from '../types/game';
import {
  DiplomaticActionType,
  PeaceDealType,
} from '../components/drawers/drawerTypes';
import { relationKey } from './worldBuilder';
import {
  adjustAggressiveExpansionGain,
  calculateProvinceDevelopment,
  formatGameDate,
  getEmbargoingNationIds,
  getOrCreateRelation,
  isAtWar,
  resolveWarParticipants,
} from './simulationEngine';
import { evaluateWartimeAiOperations } from './aiAndRebellionEngine';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from './seasonSupplyAndAiProfile';
import { autoResolveTacticalBattle } from './tacticalBattleEngine';
import { withUpdatedLordLoyalty } from './pashaAndFiefEngine';
import { sound } from '../utils/soundEngine';

export interface DomainActionPatch {
  nations?: Record<string, Nation>;
  territories?: Record<string, Territory>;
  relations?: Record<string, DiplomaticRelation>;
  wars?: ActiveWar[];
  movements?: ArmyMovement[];
  newsEvents?: WorldNewsEvent[];
  toast?: string;
}

const DIPLOMACY_POINT_COSTS: Partial<Record<DiplomaticActionType, number>> = {
  IMPROVE: 5,
  INSULT: 10,
  NON_AGGRESSION: 20,
  MILITARY_ACCESS: 10,
  TRADE: 10,
  DEFENSIVE_PACT: 30,
  OFFENSIVE_PACT: 50,
  EMBARGO: 15,
  DECLARE_WAR: 10,
  ESPIONAGE_SABOTAGE_FORT: 25,
  ESPIONAGE_INCITE_REVOLT: 30,
  ESPIONAGE_SIPHON_TREASURY: 20,
};

function spendDiplomacyPoints(
  nation: Nation,
  cost: number
): { nation: Nation } | { error: string } {
  const current = nation.diplomacyPoints ?? 100;
  if (current < cost) {
    return {
      error: `Yetersiz diplomasi puanı: ${cost} gerekli, mevcut ${current.toFixed(0)}.`,
    };
  }
  return { nation: { ...nation, diplomacyPoints: current - cost } };
}

function prependNews(
  newsEvents: WorldNewsEvent[],
  tick: number,
  gameMode: GameModeId,
  title: string,
  description: string,
  type: WorldNewsEvent['type']
): WorldNewsEvent[] {
  return [
    {
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tick,
      dateStr: formatGameDate(tick, gameMode),
      title,
      description,
      type,
    },
    ...newsEvents.slice(0, 39),
  ];
}

export function applyConquestDiplomaticPenalty(params: {
  conquerorId: string;
  victimId: string;
  provincesTakenCount: number;
  isFullAnnexation: boolean;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
}): {
  updatedRelations: Record<string, DiplomaticRelation>;
  affectedNames: string[];
} {
  const {
    conquerorId,
    victimId,
    provincesTakenCount,
    isFullAnnexation,
    nations,
    relations,
  } = params;
  const victim = nations[victimId];
  if (!victim) return { updatedRelations: relations, affectedNames: [] };

  const updatedRelations: Record<string, DiplomaticRelation> = { ...relations };
  const affectedNames: string[] = [];
  const scale = isFullAnnexation
    ? 1.25
    : Math.min(1.3, 0.75 + Math.max(1, provincesTakenCount) * 0.15);

  for (const third of Object.values(nations)) {
    if (
      !third ||
      third.isEliminated ||
      third.id === conquerorId ||
      third.id === victimId
    ) {
      continue;
    }

    const relWithVictim = getOrCreateRelation(updatedRelations, third.id, victimId);
    const isAllyOfVictim = Boolean(
      relWithVictim.isAllied || relWithVictim.allianceType
    );
    const isFriendOrPartner =
      relWithVictim.hasTradeAgreement ||
      relWithVictim.hasNonAggression ||
      relWithVictim.score >= 25;
    const isSameCultureOrReligion =
      Boolean(
        victim.stateReligion && third.stateReligion === victim.stateReligion
      ) ||
      Boolean(
        victim.primaryCulture && third.primaryCulture === victim.primaryCulture
      );

    let penalty = 0;
    if (isAllyOfVictim) {
      penalty = Math.round(35 * scale);
    } else if (isFriendOrPartner) {
      penalty = Math.round(20 * scale);
    } else if (isSameCultureOrReligion) {
      penalty = Math.round(12 * scale);
    }

    if (penalty <= 0) continue;

    const key = relationKey(conquerorId, third.id);
    const curRel = getOrCreateRelation(updatedRelations, conquerorId, third.id);
    updatedRelations[key] = {
      ...curRel,
      score: Math.max(-100, curRel.score - penalty),
    };
    if (isAllyOfVictim || isFriendOrPartner) {
      affectedNames.push(`${third.name} (-${penalty})`);
    }
  }

  return { updatedRelations, affectedNames };
}

export function executeDiplomaticActionDomain(params: {
  targetNationId: string;
  action: DiplomaticActionType;
  playerNationId: string;
  totalPlayerGarrison: number;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements?: ArmyMovement[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    targetNationId,
    action,
    playerNationId,
    totalPlayerGarrison,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    movements = [],
    newsEvents,
  } = params;

  const playerNation = nations[playerNationId];
  const target = nations[targetNationId];
  if (!playerNation || !target) return {};

  const key = relationKey(playerNationId, targetNationId);
  const currentRel = getOrCreateRelation(relations, playerNationId, targetNationId);

  if (action === 'IMPROVE') {
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.IMPROVE || 0
    );
    if ('error' in spent) return { toast: spent.error };
    sound.playTreaty();
    return {
      nations: {
        ...nations,
        [playerNationId]: spent.nation,
      },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          score: Math.min(100, currentRel.score + 20),
        },
      },
      toast: `${target.name} ile diplomatik ilişkiler +20 gelişti (-${DIPLOMACY_POINT_COSTS.IMPROVE} DP).`,
    };
  }

  if (action === 'INSULT') {
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.INSULT || 0
    );
    if ('error' in spent) return { toast: spent.error };
    sound.playClick();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          isAllied: false,
          hasNonAggression: false,
          score: Math.max(-100, currentRel.score - 25),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `Diplomatik Gerilim: ${playerNation.name} - ${target.name}`,
        `${playerNation.name} Dışişleri Bakanlığı, ${target.name} hükümetine sert bir diplomatik nota verdi.`,
        'WAR'
      ),
      toast: `${target.name} hükümetine diplomatik nota verildi (-25 İlişki).`,
    };
  }

  if (action === 'NON_AGGRESSION') {
    if (!currentRel.hasNonAggression && currentRel.score < -10) {
      return {
        toast: `${target.name} ile Saldırmazlık Paktı için ilişkinin en az -10 olması gerekir.`,
      };
    }
    const spent = currentRel.hasNonAggression
      ? { nation: playerNation }
      : spendDiplomacyPoints(playerNation, DIPLOMACY_POINT_COSTS.NON_AGGRESSION || 0);
    if ('error' in spent) return { toast: spent.error };
    sound.playTreaty();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          hasNonAggression: !currentRel.hasNonAggression,
          score: Math.min(100, currentRel.score + 10),
        },
      },
      toast: currentRel.hasNonAggression
        ? `${target.name} ile Saldırmazlık Paktı sona erdirildi.`
        : `${target.name} ile Karşılıklı Saldırmazlık Paktı imzalandı!`,
    };
  }

  if (action === 'MILITARY_ACCESS') {
    if (!currentRel.hasMilitaryAccess && currentRel.score < 5) {
      return {
        toast: `${target.name} askeri geçiş izni için en az +5 ilişki puanı talep ediyor.`,
      };
    }
    const spent = currentRel.hasMilitaryAccess
      ? { nation: playerNation }
      : spendDiplomacyPoints(playerNation, DIPLOMACY_POINT_COSTS.MILITARY_ACCESS || 0);
    if ('error' in spent) return { toast: spent.error };
    sound.playTreaty();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          hasMilitaryAccess: !currentRel.hasMilitaryAccess,
          score: currentRel.hasMilitaryAccess
            ? currentRel.score
            : Math.min(100, currentRel.score + 8),
        },
      },
      toast: currentRel.hasMilitaryAccess
        ? `${target.name} ile askeri geçiş anlaşması iptal edildi.`
        : `${target.name} topraklarından Askeri Geçiş İzni alındı!`,
    };
  }

  if (action === 'TRADE') {
    if (isAtWar(wars, playerNationId, targetNationId)) {
      return { toast: 'Savaş halindeki bir devletle ticaret anlaşması imzalanamaz!' };
    }
    if (!currentRel.hasTradeAgreement && currentRel.score < 5) {
      return {
        toast: `${target.name} ile Serbest Ticaret Anlaşması için en az +5 ilişki puanı gerekir (Mevcut: ${currentRel.score}).`,
      };
    }
    const spent = currentRel.hasTradeAgreement
      ? { nation: playerNation }
      : spendDiplomacyPoints(playerNation, DIPLOMACY_POINT_COSTS.TRADE || 0);
    if ('error' in spent) return { toast: spent.error };
    sound.playTreaty();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          hasTradeAgreement: !currentRel.hasTradeAgreement,
          hasEmbargo: false,
          embargoingNationIds: [],
          score: Math.min(100, currentRel.score + 10),
        },
      },
      toast: currentRel.hasTradeAgreement
        ? `${target.name} ile ticaret anlaşması feshedildi.`
        : `${target.name} ile Serbest Ticaret Anlaşması imzalandı!`,
    };
  }

  if (
    action === 'DEFENSIVE_PACT' ||
    (action === 'ALLIANCE' && currentRel.allianceType === 'DEFENSIVE')
  ) {
    const isCurrentlyDefensive = currentRel.allianceType === 'DEFENSIVE';
    if (isCurrentlyDefensive) {
      sound.playClick();
      return {
        relations: {
          ...relations,
          [key]: {
            ...currentRel,
            isAllied: false,
            allianceType: null,
          },
        },
        newsEvents: prependNews(
          newsEvents,
          tick,
          gameMode,
          `${playerNation.name} - ${target.name} Savunma Paktı Sona Erdi`,
          `${playerNation.name} ve ${target.name} arasındaki Karşılıklı Savunma Paktı feshedildi.`,
          'PEACE'
        ),
        toast: `${target.name} ile Karşılıklı Savunma Paktı feshedildi.`,
      };
    }

    if (currentRel.score < 25) {
      return {
        toast: `${target.name} ile Savunma Paktı imzalamak için en az +25 ilişki puanı gerekir (Mevcut: ${currentRel.score}).`,
      };
    }

    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.DEFENSIVE_PACT || 0
    );
    if ('error' in spent) return { toast: spent.error };

    sound.playTreaty();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          isAllied: true,
          allianceType: 'DEFENSIVE',
          hasMilitaryAccess: true,
          score: Math.min(100, currentRel.score + 15),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🛡️ ${playerNation.name} - ${target.name} Savunma Paktı`,
        `${playerNation.name} ve ${target.name} Karşılıklı Savunma Paktı imzaladı. Üyelerden biri saldırıya uğradığında diğeri otomatik olarak savunma savaşına katılacak.`,
        'PEACE'
      ),
      toast: `🛡️ ${target.name} ile Karşılıklı Savunma Paktı imzalandı! Sadece savunma savaşlarında tetiklenir.`,
    };
  }

  if (
    action === 'OFFENSIVE_PACT' ||
    (action === 'ALLIANCE' && currentRel.allianceType !== 'DEFENSIVE')
  ) {
    const isCurrentlyOffensive = currentRel.allianceType === 'OFFENSIVE';
    if (isCurrentlyOffensive) {
      sound.playClick();
      return {
        relations: {
          ...relations,
          [key]: {
            ...currentRel,
            isAllied: false,
            allianceType: null,
          },
        },
        newsEvents: prependNews(
          newsEvents,
          tick,
          gameMode,
          `${playerNation.name} - ${target.name} Saldırı Paktı Sona Erdi`,
          `${playerNation.name} ve ${target.name} arasındaki Saldırı ve Askeri Koalisyon Paktı feshedildi.`,
          'PEACE'
        ),
        toast: `${target.name} ile Saldırı ve Koalisyon Paktı feshedildi.`,
      };
    }

    if (currentRel.score < 45) {
      return {
        toast: `${target.name} ile Saldırı Paktı için en az +45 ilişki puanı ve yüksek güven gerekir (Mevcut: ${currentRel.score}).`,
      };
    }

    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.OFFENSIVE_PACT || 0
    );
    if ('error' in spent) return { toast: spent.error };

    sound.playTreaty();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          isAllied: true,
          allianceType: 'OFFENSIVE',
          hasMilitaryAccess: true,
          score: Math.min(100, currentRel.score + 25),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `⚔️ ${playerNation.name} - ${target.name} Saldırı & Koalisyon Paktı`,
        `${playerNation.name} ve ${target.name} Saldırı ve Tam Askeri İttifak Paktı imzaladı! Ortak hedefe savaş açıldığında ve savunmada birlikte taarruz edilecek.`,
        'PEACE'
      ),
      toast: `⚔️ ${target.name} ile Saldırı Paktı imzalandı! Ortak savaş ilanlarına katılacaktır.`,
    };
  }

  if (action === 'EMBARGO') {
    const embargoingNationIds = getEmbargoingNationIds(currentRel);
    const alreadyEmbargoing = embargoingNationIds.includes(playerNationId);
    const nextEmbargoingNationIds = alreadyEmbargoing
      ? embargoingNationIds.filter((nationId) => nationId !== playerNationId)
      : [...embargoingNationIds, playerNationId];
    const spent = alreadyEmbargoing
      ? { nation: playerNation }
      : spendDiplomacyPoints(playerNation, DIPLOMACY_POINT_COSTS.EMBARGO || 0);
    if ('error' in spent) return { toast: spent.error };
    sound.playClick();
    return {
      nations: { ...nations, [playerNationId]: spent.nation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          hasEmbargo: nextEmbargoingNationIds.length > 0,
          embargoingNationIds: nextEmbargoingNationIds,
          hasTradeAgreement: false,
          score: Math.max(-100, currentRel.score - 20),
        },
      },
      toast: alreadyEmbargoing
        ? `${target.name} üzerindeki ticaret ambargosu kaldırıldı.`
        : `${target.name} ekonomisine Ticaret Ambargosu uygulandı!`,
    };
  }

  if (action === 'ULTIMATUM_VASSAL') {
    if (target.vassalOf === playerNationId) {
      return { toast: `${target.name} zaten sizin vasalınız.` };
    }
    if (isAtWar(wars, playerNationId, targetNationId)) {
      return { toast: 'Savaş halindeki bir devlete barışçıl vasallık ültimatomu verilemez.' };
    }
    const spent = spendDiplomacyPoints(playerNation, 20);
    if ('error' in spent) return { toast: spent.error };

    const targetArmy = Object.values(territories)
      .filter((t) => t.ownerId === targetNationId)
      .reduce((s, t) => s + t.garrison, 0);
    const targetPersonality = resolveNationAiPersonality(target, territories);
    const meta = AI_PERSONALITY_META[targetPersonality];
    const requiredRatio = Number((1.85 * meta.ultimatumResistance).toFixed(2));

    if (totalPlayerGarrison >= Math.max(4000, targetArmy) * requiredRatio) {
      sound.playTreaty();
      return {
        nations: {
          ...nations,
          [playerNationId]: {
            ...spent.nation,
            aggressiveExpansion: Math.min(
              100,
              spent.nation.aggressiveExpansion +
                adjustAggressiveExpansionGain(spent.nation, 5)
            ),
          },
          [targetNationId]: {
            ...target,
            vassalOf: playerNationId,
          },
        },
        relations: {
          ...relations,
          [key]: {
            ...currentRel,
            score: Math.max(-100, currentRel.score - 10),
          },
        },
        newsEvents: prependNews(
          newsEvents,
          tick,
          gameMode,
          `${target.name} Egemenliğimize Girdi`,
          `${target.name} hükümeti askeri ültimatomu kabul ederek ${playerNation.name} vasalı oldu.`,
          'PEACE'
        ),
        toast: `${target.name} askeri gücümüz karşısında ültimatomu kabul etti ve Vasal Devlet oldu!`,
      };
    } else {
      sound.playWarHorn();
      return {
        nations: { ...nations, [playerNationId]: spent.nation },
        relations: {
          ...relations,
          [key]: {
            ...currentRel,
            score: Math.max(-100, currentRel.score - 25),
          },
        },
        toast: `${target.name} (${meta.shortLabel}) ültimatomu reddetti! (-25 İlişki; en az ${requiredRatio}x ordu üstünlüğü gerekir)`,
      };
    }
  }

  if (action === 'ANNEX_VASSAL') {
    if (target.vassalOf !== playerNationId) return {};
    if (currentRel.score < 20) {
      return {
        toast: `${target.name} vasalını barışçıl ilhak etmek için ilişkinin en az +20 olması gerekir (Mevcut: ${currentRel.score}).`,
      };
    }
    const annexCost = calculateVassalAnnexCost(targetNationId, territories);
    if (playerNation.treasury < annexCost) {
      return {
        toast: `Vasal entegrasyonu ve tam ilhak için ${annexCost} Altın gerekli.`,
      };
    }
    sound.playTreaty();
    const nextTerrs = { ...territories };
    Object.values(nextTerrs).forEach((t) => {
      if (t.ownerId === targetNationId) {
        nextTerrs[t.id] = {
          ...t,
          ownerId: playerNationId,
          coreOwnerId: playerNationId,
          assimilation: 100,
          isAssimilating: false,
          unrest: 8,
          isOccupied: false,
          occupiedById: undefined,
        };
      }
    });

    return {
      territories: nextTerrs,
      nations: {
        ...nations,
        [playerNationId]: {
          ...playerNation,
          treasury: playerNation.treasury - annexCost,
        },
        [targetNationId]: {
          ...target,
          isEliminated: true,
          vassalOf: null,
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `${target.name} Barışçıl Olarak İlhak Edildi`,
        `Vasal statüsündeki ${target.name}, tüm eyaletleriyle birlikte doğrudan ${playerNation.name} sınırlarına katıldı.`,
        'PEACE'
      ),
      toast: `${target.name} (-${annexCost} Altın) barışçıl olarak imparatorluğa ilhak edildi!`,
    };
  }

  if (action === 'DECLARE_WAR') {
    if (isAtWar(wars, playerNationId, targetNationId)) return {};
    if (currentRel.isAllied || currentRel.allianceType) {
      return {
        toast: `🛑 ${target.name} ile aktif müttefiklik/pakt bulunuyor! Savaş ilanı için önce ittifakı feshedin.`,
      };
    }
    if (currentRel.hasNonAggression) {
      return {
        toast: `🛑 ${target.name} ile Saldırmazlık Paktı aktif! Savaş ilanı için önce paktı iptal edin.`,
      };
    }
    if (currentRel.truceUntilTick > tick) {
      const remDays = Math.max(1, currentRel.truceUntilTick - tick);
      return {
        toast: `🛑 ${target.name} ile ateşkes devam ediyor (${remDays} gün kaldı). Ateşkes bitmeden savaş ilan edilemez.`,
      };
    }
    if (currentRel.score > -30) {
      return {
        toast: `🛑 ${target.name} ile ilişkileriniz yüksek (${currentRel.score > 0 ? `+${currentRel.score}` : currentRel.score})! Savaş ilanı için ilişki -30 veya altında olmalı (Önce 'Hakaret Et' kullanın).`,
      };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.DECLARE_WAR || 0
    );
    if ('error' in spent) return { toast: spent.error };
    sound.playWarHorn();
    const resolution = resolveWarParticipants(
      playerNationId,
      targetNationId,
      relations,
      nations
    );

    const defAllyNames = resolution.defensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);
    const attAllyNames = resolution.offensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);

    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${target.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: targetNationId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };

    const nextWars = [...wars, newWar];
    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: targetNationId,
      provincesTakenCount: 1,
      isFullAnnexation: false,
      nations,
      relations,
    });
    const nextRelations: Record<string, DiplomaticRelation> = {
      ...penaltyRes.updatedRelations,
      [key]: {
        ...currentRel,
        isAllied: false,
        allianceType: null,
        hasTradeAgreement: false,
        hasNonAggression: false,
        hasMilitaryAccess: false,
        score: -85,
      },
    };

    // Trigger immediate AI war mobilization & counter-attack response so the enemy reacts right away!
    const aiCounter = evaluateWartimeAiOperations({
      nextTick: tick,
      playerNationId,
      nations,
      territories,
      relations: nextRelations,
      wars: nextWars,
      movements,
      aiAggressiveness: 'AGGRESSIVE',
      maxActionsPerPass: 2,
    });

    let warDesc = `${playerNation.name}, ${target.name} devletine resmen savaş ilan etti.`;
    if (attAllyNames.length > 0) {
      warDesc += ` Saldırı Paktı müttefikleriniz (${attAllyNames.join(', ')}) ortak taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Hedefin Savunma Paktı ortakları (${defAllyNames.join(', ')}) savunmaya katıldı!`;
    }

    let updatedNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      newWar.name,
      warDesc,
      'WAR'
    );
    if (aiCounter?.newsItems.length) {
      for (const item of aiCounter.newsItems) {
        updatedNews = prependNews(
          updatedNews,
          tick,
          gameMode,
          item.title,
          item.description,
          item.type
        );
      }
    }

    const baseToast =
      defAllyNames.length > 0
        ? `⚔️ ${target.name} ile savaş başladı (Savunma Paktı: ${defAllyNames.join(', ')})`
        : attAllyNames.length > 0
        ? `⚔️ ${target.name} ile savaş başladı (Müttefik: ${attAllyNames.join(', ')})`
        : `⚔️ ${target.name} devletine savaş ilan edildi!`;
    const nextNations = {
      ...(aiCounter?.updatedNations || nations),
      [playerNationId]: spent.nation,
    };

    return {
      nations: nextNations,
      ...(aiCounter?.updatedTerritories
        ? { territories: aiCounter.updatedTerritories }
        : {}),
      ...(aiCounter?.newMovements?.length
        ? { movements: [...movements, ...aiCounter.newMovements] }
        : {}),
      wars: nextWars,
      relations: nextRelations,
      newsEvents: updatedNews,
      toast: baseToast,
    };
  }

  // =========================================================================
  // COVERT ESPIONAGE OPERATIONS (Kale Sabotajı, İsyan Kışkırtma, Hazine/Bilim Sızdırma)
  // =========================================================================
  if (action === 'ESPIONAGE_SABOTAGE_FORT') {
    const goldCost = 220;
    if (playerNation.treasury < goldCost) {
      return {
        toast: `🕵️ Kale Sabotajı için ${goldCost} Altın gerekli (Mevcut: ${Math.floor(playerNation.treasury)}).`,
      };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.ESPIONAGE_SABOTAGE_FORT || 25
    );
    if ('error' in spent) return { toast: spent.error };

    const targetProvs = Object.values(territories).filter(
      (t) => t && t.ownerId === targetNationId
    );
    if (targetProvs.length === 0) return {};

    // Prioritize besieged enemy province, or border province facing player, or enemy capital
    const bestFortProv = [...targetProvs].sort((a, b) => {
      const aSiege = a.siege ? 1 : 0;
      const bSiege = b.siege ? 1 : 0;
      if (aSiege !== bSiege) return bSiege - aSiege;
      const aBordersPlayer = a.neighbors.some(
        (nId) => territories[nId]?.ownerId === playerNationId
      )
        ? 1
        : 0;
      const bBordersPlayer = b.neighbors.some(
        (nId) => territories[nId]?.ownerId === playerNationId
      )
        ? 1
        : 0;
      if (aBordersPlayer !== bBordersPlayer) return bBordersPlayer - aBordersPlayer;
      return (
        (b.buildings?.fortress || 0) - (a.buildings?.fortress || 0) ||
        Number(b.isCapital) - Number(a.isCapital) ||
        b.garrison - a.garrison
      );
    })[0];

    const newGarrison = Math.max(400, Math.round(bestFortProv.garrison * 0.86));
    const ratio = newGarrison / Math.max(1, bestFortProv.garrison);
    const casualties = bestFortProv.garrison - newGarrison;
    const nextWallHp = Math.min(35, Math.max(15, (bestFortProv.castleWallHp ?? 100) - 55));
    const nextSiege = bestFortProv.siege
      ? {
          ...bestFortProv.siege,
          progress: Math.min(95, bestFortProv.siege.progress + 35),
          wallIntegrity: Math.min(35, bestFortProv.siege.wallIntegrity - 45),
        }
      : bestFortProv.siege;

    sound.playClick();
    return {
      nations: {
        ...nations,
        [playerNationId]: {
          ...spent.nation,
          treasury: spent.nation.treasury - goldCost,
        },
      },
      territories: {
        ...territories,
        [bestFortProv.id]: {
          ...bestFortProv,
          castleWallHp: nextWallHp,
          garrison: newGarrison,
          units: bestFortProv.units
            ? {
                infantry: Math.round(bestFortProv.units.infantry * ratio),
                armor: Math.round(bestFortProv.units.armor * ratio),
                airDrone: Math.round(bestFortProv.units.airDrone * ratio),
              }
            : { infantry: newGarrison, armor: 0, airDrone: 0 },
          siege: nextSiege,
        },
      },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          score: Math.max(-100, currentRel.score - 15),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🕵️ Kale Sabotajı: ${bestFortProv.name}`,
        `Casuslarımız ${target.name} kontrolündeki ${bestFortProv.name} kalesinin barut mahzenlerini havaya uçurdu! Sur sağlamlığı %${nextWallHp} seviyesine indi (-${casualties.toLocaleString('tr-TR')} garnizon).`,
        'WAR'
      ),
      toast: `🕵️ Kale Sabotajı Başarılı: ${bestFortProv.name} surları %${nextWallHp} seviyesine düşürüldü (-${casualties.toLocaleString('tr-TR')} düşman askeri)!`,
    };
  }

  if (action === 'ESPIONAGE_INCITE_REVOLT') {
    const goldCost = 260;
    if (playerNation.treasury < goldCost) {
      return {
        toast: `🕵️ İsyan Kışkırtma için ${goldCost} Altın gerekli (Mevcut: ${Math.floor(playerNation.treasury)}).`,
      };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.ESPIONAGE_INCITE_REVOLT || 30
    );
    if ('error' in spent) return { toast: spent.error };

    const targetProvs = Object.values(territories).filter(
      (t) => t && t.ownerId === targetNationId
    );
    if (targetProvs.length === 0) return {};

    // Target province with highest unrest or non-core province first
    const revoltProv = [...targetProvs].sort((a, b) => {
      const aNonCore = a.coreOwnerId !== targetNationId ? 1 : 0;
      const bNonCore = b.coreOwnerId !== targetNationId ? 1 : 0;
      if (aNonCore !== bNonCore) return bNonCore - aNonCore;
      return (b.unrest || 0) - (a.unrest || 0);
    })[0];

    const nextUnrest = Math.min(100, Math.round((revoltProv.unrest || 10) + 42));
    const revoltDamage = Math.min(
      Math.max(300, Math.round(revoltProv.garrison * 0.22)),
      Math.max(0, revoltProv.garrison - 400)
    );
    const nextGarrison = Math.max(400, revoltProv.garrison - revoltDamage);
    const ratio = nextGarrison / Math.max(1, revoltProv.garrison);

    sound.playClick();
    return {
      nations: {
        ...nations,
        [playerNationId]: {
          ...spent.nation,
          treasury: spent.nation.treasury - goldCost,
        },
        [targetNationId]: {
          ...target,
          stability: Math.max(15, (target.stability || 70) - 8),
        },
      },
      territories: {
        ...territories,
        [revoltProv.id]: {
          ...revoltProv,
          unrest: nextUnrest,
          garrison: nextGarrison,
          units: revoltProv.units
            ? {
                infantry: Math.round(revoltProv.units.infantry * ratio),
                armor: Math.round(revoltProv.units.armor * ratio),
                airDrone: Math.round(revoltProv.units.airDrone * ratio),
              }
            : { infantry: nextGarrison, armor: 0, airDrone: 0 },
        },
      },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          score: Math.max(-100, currentRel.score - 18),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🔥 Kışkırtılan Ayaklanma: ${revoltProv.name}`,
        `${revoltProv.name} (${target.name}) eyaletinde gizli ajanların kışkırttığı silahlı milisler ayaklandı! Huzursuzluk %${nextUnrest} seviyesine çıktı (-${revoltDamage.toLocaleString('tr-TR')} garnizon kaybı).`,
        'WAR'
      ),
      toast: `🔥 ${revoltProv.name} (${target.name}) eyaletinde isyan kışkırtıldı! Huzursuzluk %${nextUnrest}, -${revoltDamage.toLocaleString('tr-TR')} düşman askeri.`,
    };
  }

  if (action === 'ESPIONAGE_SIPHON_TREASURY') {
    const goldCost = 150;
    if (playerNation.treasury < goldCost) {
      return {
        toast: `🕵️ İstihbarat Sızdırma operasyonu için ${goldCost} Altın gerekli.`,
      };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.ESPIONAGE_SIPHON_TREASURY || 20
    );
    if ('error' in spent) return { toast: spent.error };

    const stolenGold = Math.min(
      520,
      Math.max(210, Math.round((target.treasury || 600) * 0.22))
    );
    const stolenResearch = 35;

    sound.playTreaty();
    return {
      nations: {
        ...nations,
        [playerNationId]: {
          ...spent.nation,
          treasury: spent.nation.treasury - goldCost + stolenGold,
          researchPoints: Number(
            ((spent.nation.researchPoints || 0) + stolenResearch).toFixed(1)
          ),
        },
        [targetNationId]: {
          ...target,
          treasury: Math.max(0, (target.treasury || 0) - stolenGold),
        },
      },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          score: Math.max(-100, currentRel.score - 12),
        },
      },
      toast: `🕵️ Hazine & Bilim Sızdırıldı (${target.name}): Net +${stolenGold - goldCost} Altın ve +${stolenResearch} Araştırma Puanı ele geçirildi!`,
    };
  }

  return {};
}

export function resolveTacticalBattleOutcomeDomain(params: {
  finalBattle: TacticalBattleState;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    finalBattle,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    wars,
    newsEvents,
  } = params;

  let outcome = finalBattle.outcome;
  if (!outcome) {
    const auto = autoResolveTacticalBattle(
      finalBattle,
      finalBattle.attackerNationId === playerNationId,
      nations[finalBattle.attackerNationId],
      nations[finalBattle.defenderNationId]
    );
    outcome = auto.outcome;
  }
  if (!outcome) return {};

  const winnerId = outcome.winnerId;
  const isAttackerWinner = outcome.territoryConquered;

  const nextTerrs = { ...territories };
  const nextNations = { ...nations };
  const cur = nextTerrs[finalBattle.territoryId];

  if (cur) {
    if (isAttackerWinner) {
      const previousOwnerId = cur.ownerId;
      const coreId = cur.coreOwnerId;
      const allyBeneficiary =
        coreId &&
        coreId !== finalBattle.attackerNationId &&
        coreId !== previousOwnerId &&
        nextNations[coreId] &&
        (nextNations[coreId].vassalOf === finalBattle.attackerNationId ||
          nextNations[finalBattle.attackerNationId]?.vassalOf === coreId ||
          wars.some(
            (w) =>
              (w.attackers.includes(finalBattle.attackerNationId) &&
                w.attackers.includes(coreId)) ||
              (w.defenders.includes(finalBattle.attackerNationId) &&
                w.defenders.includes(coreId))
          ))
          ? coreId
          : null;

      if (allyBeneficiary) {
        const allyNation = nextNations[allyBeneficiary];
        const allyWasEliminated = Boolean(allyNation?.isEliminated);
        if (allyNation && allyWasEliminated) {
          nextNations[allyBeneficiary] = {
            ...allyNation,
            isEliminated: false,
            capitalTerritoryId: finalBattle.territoryId,
          };
        }
        nextTerrs[finalBattle.territoryId] = {
          ...cur,
          ownerId: allyBeneficiary,
          isCapital: allyWasEliminated || allyNation?.capitalTerritoryId === finalBattle.territoryId,
          garrison: 1200,
          units: { infantry: 1000, armor: 200, airDrone: 0 },
          unrest: Math.max(0, cur.unrest - 15),
          assimilation: 100,
          isAssimilating: false,
          isOccupied: false,
          occupiedById: undefined,
          castleWallHp: finalBattle.castleWallHp,
        };
        const surviving = Math.max(1000, outcome.attackerSurvivingTroops);
        const returnNeighborId = cur.neighbors.find(
          (nId) => nextTerrs[nId]?.ownerId === finalBattle.attackerNationId
        );
        const capId = nextNations[finalBattle.attackerNationId]?.capitalTerritoryId;
        const returnDestId =
          returnNeighborId ||
          (capId && nextTerrs[capId]?.ownerId === finalBattle.attackerNationId ? capId : null);
        if (returnDestId && nextTerrs[returnDestId]) {
          const rd = nextTerrs[returnDestId];
          nextTerrs[returnDestId] = {
            ...rd,
            garrison: rd.garrison + surviving,
            units: {
              infantry: (rd.units?.infantry ?? rd.garrison) + Math.round(surviving * 0.7),
              armor: (rd.units?.armor ?? 0) + Math.round(surviving * 0.2),
              airDrone: (rd.units?.airDrone ?? 0) + Math.round(surviving * 0.1),
            },
          };
        }
      } else {
        const isCoreForConqueror = cur.coreOwnerId === finalBattle.attackerNationId;
        nextTerrs[finalBattle.territoryId] = {
          ...cur,
          ownerId: finalBattle.attackerNationId,
          isCapital: false,
          garrison: Math.max(1000, outcome.attackerSurvivingTroops),
          units: {
            infantry: Math.round(outcome.attackerSurvivingTroops * 0.7),
            armor: Math.round(outcome.attackerSurvivingTroops * 0.2),
            airDrone: Math.round(outcome.attackerSurvivingTroops * 0.1),
          },
          unrest: isCoreForConqueror ? Math.max(0, cur.unrest - 10) : Math.min(80, cur.unrest + 25),
          assimilation: isCoreForConqueror ? 100 : 25,
          isAssimilating: false,
          isOccupied: !isCoreForConqueror,
          occupiedById: isCoreForConqueror ? undefined : finalBattle.attackerNationId,
          castleWallHp: finalBattle.castleWallHp,
        };
      }

      // Check if defender lost its capital or its last territory
      const remainingDefProvs = Object.values(nextTerrs).filter(
        (t) => t && t.ownerId === previousOwnerId
      );
      const prevDefNation = nextNations[previousOwnerId];
      if (prevDefNation) {
        if (remainingDefProvs.length === 0) {
          nextNations[previousOwnerId] = {
            ...prevDefNation,
            isEliminated: true,
          };
        } else if (prevDefNation.capitalTerritoryId === finalBattle.territoryId) {
          const newCap = remainingDefProvs[0];
          nextNations[previousOwnerId] = {
            ...prevDefNation,
            capitalTerritoryId: newCap.id,
          };
          nextTerrs[newCap.id] = {
            ...newCap,
            isCapital: true,
          };
        }
      }
    } else {
      nextTerrs[finalBattle.territoryId] = {
        ...cur,
        garrison: Math.max(800, outcome.defenderSurvivingTroops),
        castleWallHp: finalBattle.castleWallHp,
      };

      // Return surviving attacker troops to an adjacent friendly territory (or capital) instead of vanishing
      const retreatTroops = Math.max(0, outcome.attackerSurvivingTroops);
      if (retreatTroops >= 500) {
        const friendlyNeighborId = cur.neighbors.find(
          (nbId) => nextTerrs[nbId]?.ownerId === finalBattle.attackerNationId
        );
        const attackerCapId =
          nextNations[finalBattle.attackerNationId]?.capitalTerritoryId;
        const fallbackFriendlyId = Object.values(nextTerrs).find(
          (t) => t && t.ownerId === finalBattle.attackerNationId
        )?.id;
        const retreatTargetId =
          friendlyNeighborId ||
          (attackerCapId &&
          nextTerrs[attackerCapId]?.ownerId === finalBattle.attackerNationId
            ? attackerCapId
            : fallbackFriendlyId);

        if (retreatTargetId && nextTerrs[retreatTargetId]) {
          const rt = nextTerrs[retreatTargetId];
          nextTerrs[retreatTargetId] = {
            ...rt,
            garrison: rt.garrison + retreatTroops,
            units: {
              infantry:
                (rt.units?.infantry || 0) + Math.round(retreatTroops * 0.7),
              armor: (rt.units?.armor || 0) + Math.round(retreatTroops * 0.2),
              airDrone:
                (rt.units?.airDrone || 0) + Math.round(retreatTroops * 0.1),
            },
          };
        }
      }
    }
  }

  const defenderFullyEliminated = Boolean(
    isAttackerWinner && nextNations[finalBattle.defenderNationId]?.isEliminated
  );

  const nextWars = wars.map((w) => {
    const involvesBoth =
      (w.attackers.includes(finalBattle.attackerNationId) &&
        w.defenders.includes(finalBattle.defenderNationId)) ||
      (w.attackers.includes(finalBattle.defenderNationId) &&
        w.defenders.includes(finalBattle.attackerNationId));
    if (!involvesBoth) return w;
    const isAttackerSide = w.attackers.includes(finalBattle.attackerNationId);
    const baseDelta = defenderFullyEliminated ? 100 : isAttackerWinner ? 28 : -28;
    const scoreDelta = baseDelta * (isAttackerSide ? 1 : -1);

    return {
      ...w,
      attackerWarScore: Math.max(
        -100,
        Math.min(100, w.attackerWarScore + scoreDelta)
      ),
      casualtiesAttacker: w.casualtiesAttacker + outcome!.attackerTotalLosses,
      casualtiesDefender: w.casualtiesDefender + outcome!.defenderTotalLosses,
    };
  });

  if (nextNations[winnerId]) {
    let wNat: Nation = {
      ...nextNations[winnerId],
      researchPoints: Number(
        (nextNations[winnerId].researchPoints + outcome.earnedResearch).toFixed(1)
      ),
      clanInfluence: Math.min(
        999,
        (nextNations[winnerId].clanInfluence ?? 120) + outcome.earnedInfluence
      ),
      aggressiveExpansion: isAttackerWinner
        ? Math.min(
            100,
            nextNations[winnerId].aggressiveExpansion +
              adjustAggressiveExpansionGain(nextNations[winnerId], 6)
          )
        : nextNations[winnerId].aggressiveExpansion,
    };
    if (wNat.activeGeneralId) {
      wNat = withUpdatedLordLoyalty(wNat, wNat.activeGeneralId, 6);
    }
    nextNations[winnerId] = wNat;
  }

  const loserId = outcome.loserId;
  if (nextNations[loserId]?.activeGeneralId) {
    nextNations[loserId] = withUpdatedLordLoyalty(
      nextNations[loserId],
      nextNations[loserId].activeGeneralId!,
      -4
    );
  }

  const winnerNation = nextNations[winnerId];
  let nextNews = newsEvents;
  let toast: string;

  if (winnerId === playerNationId) {
    sound.playVictory();
    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `🏆 ${finalBattle.territoryName} Muharebesi Zaferi`,
      `${winnerNation?.name} orduları ${finalBattle.territoryName} mevkiinde zafer kazandı (+${outcome.earnedResearch} 🔬, +${outcome.earnedInfluence} ⚜).`,
      'WAR'
    );
    toast = `🏆 ${finalBattle.territoryName} muharebesi kazanıldı (+${outcome.earnedResearch} 🔬)`;
  } else {
    sound.playDefeat();
    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `🛑 ${finalBattle.territoryName} Cephesinde Ricat`,
      `${finalBattle.territoryName} muharebesi kaybedildi, birlikler sınır hattına çekildi.`,
      'WAR'
    );
    toast = `🛑 ${finalBattle.territoryName} muharebesi kaybedildi`;
  }

  return {
    territories: nextTerrs,
    wars: nextWars,
    nations: nextNations,
    newsEvents: nextNews,
    toast,
  };
}

export function resolvePeaceDealDomain(params: {
  warId: string;
  dealType: PeaceDealType;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    warId,
    dealType,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === warId);
  const playerNation = nations[playerNationId];
  if (!war || !playerNation) return {};

  const isPlayerAttackerSide = war.attackers.includes(playerNationId);
  const enemyId = isPlayerAttackerSide ? war.defenderId : war.attackerId;
  const enemy = nations[enemyId];
  const key = relationKey(playerNationId, enemyId);

  // Effective war score from the player's perspective (-100 to +100)
  const playerWarScore = isPlayerAttackerSide
    ? war.attackerWarScore
    : -war.attackerWarScore;

  // Count enemy territories currently occupied by the player
  const occupiedProvs = Object.values(territories).filter(
    (t) =>
      t &&
      t.ownerId === playerNationId &&
      t.isOccupied &&
      (t.coreOwnerId === enemyId ||
        war.attackers.includes(t.coreOwnerId) ||
        war.defenders.includes(t.coreOwnerId))
  );

  // Effective war score including occupied provinces (+25 required for peace deals!)
  const effectiveDealScore = Math.max(
    playerWarScore,
    Math.round(Math.max(0, playerWarScore) + occupiedProvs.length * 14)
  );

  // Enforce realistic AoH3 +25 War Score threshold before accepting peace demands or white peace!
  if (dealType === 'ANNEX_OCCUPIED') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} barış masasına oturmuyor! Barış anlaşması için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectiveDealScore}).`,
      };
    }
  } else if (dealType === 'VASSALIZE') {
    if (playerWarScore < 50 && !enemy?.isEliminated) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} bağımsızlığından vazgeçmiyor! Vasallaştırmak için Savaş Skorunun en az +%50 olması gerekir (Mevcut: %${playerWarScore}).`,
      };
    }
  } else if (dealType === 'REPARATIONS') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} savaş tazminatı ödemeyi reddediyor! En az +25 Savaş Skoru gerekli (Mevcut: %${effectiveDealScore}).`,
      };
    }
  } else if (dealType === 'WHITE_PEACE') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 Savaş ilan edildikten hemen sonra barış yapılamaz! Barış imzalamak için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectiveDealScore}).`,
      };
    }
  }

  sound.playTreaty();

  const nextNations = { ...nations };
  const nextTerritories = { ...territories };
  let workingRelations = { ...relations };
  let nextNews = newsEvents;
  let toast = `${enemy?.name} ile Beyaz Barış imzalandı.`;

  if (dealType === 'ANNEX_OCCUPIED') {
    const extraProvincesAllowed =
      playerWarScore >= 75 ? 2 : playerWarScore >= 45 ? 1 : 0;
    let annexedCount = 0;

    Object.values(nextTerritories).forEach((t) => {
      if (t.ownerId === playerNationId && t.isOccupied) {
        const isCore = t.coreOwnerId === playerNationId;
        annexedCount++;
        nextTerritories[t.id] = {
          ...t,
          isOccupied: false,
          occupiedById: undefined,
          assimilation: isCore ? 100 : Math.min(t.assimilation ?? 25, 85),
          isAssimilating: false,
        };
      }
    });

    const remainingEnemyTerrs = Object.values(nextTerritories).filter(
      (t) => t.ownerId === enemyId
    );
    remainingEnemyTerrs.slice(0, extraProvincesAllowed).forEach((t) => {
      const isCore = t.coreOwnerId === playerNationId;
      annexedCount++;
      nextTerritories[t.id] = {
        ...t,
        ownerId: playerNationId,
        isCapital: false,
        isOccupied: false,
        occupiedById: undefined,
        assimilation: isCore ? 100 : 25,
        isAssimilating: false,
        unrest: isCore ? Math.max(0, t.unrest - 10) : Math.min(75, t.unrest + 20),
      };
    });

    const stillOwned = Object.values(nextTerritories).filter(
      (t) => t.ownerId === enemyId
    );
    const fullAnnex = stillOwned.length === 0;
    if (fullAnnex && nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        isEliminated: true,
      };
    } else if (
      stillOwned.length > 0 &&
      nextNations[enemyId] &&
      nextTerritories[nextNations[enemyId].capitalTerritoryId]?.ownerId !== enemyId
    ) {
      const newCap = stillOwned[0];
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        capitalTerritoryId: newCap.id,
      };
      nextTerritories[newCap.id] = {
        ...newCap,
        isCapital: true,
      };
    }

    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyId,
      provincesTakenCount: Math.max(1, annexedCount),
      isFullAnnexation: fullAnnex,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;

    const diploSuffix =
      penaltyRes.affectedNames.length > 0
        ? ` (Dost/Müttefik tepkisi: ${penaltyRes.affectedNames.slice(0, 3).join(', ')})`
        : '';

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${war.name} Sona Erdi`,
      `${playerNation.name} ve ${enemy?.name} arasında imzalanan barış antlaşmasıyla ${Math.max(1, annexedCount)} eyalet resmen ilhak edildi.${diploSuffix}`,
      'PEACE'
    );
    toast = `📜 ${enemy?.name} ile Barış: ${Math.max(1, annexedCount)} eyalet ilhak edildi (Eyalet panelinden Asimile Et başlatabilirsiniz).${diploSuffix}`;
  } else if (dealType === 'VASSALIZE') {
    if (nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        vassalOf: playerNationId,
      };
    }
    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyId,
      provincesTakenCount: 2,
      isFullAnnexation: false,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${enemy?.name} Vasallaştırıldı`,
      `${enemy?.name}, barış antlaşması şartları gereği ${playerNation.name} himayesine girdi.`,
      'PEACE'
    );
    toast = `👑 ${enemy?.name} barış antlaşmasıyla Vasal Devlet statüsüne alındı!`;
  } else if (dealType === 'REPARATIONS') {
    const indemnity = Math.min(
      1100,
      Math.max(400, Math.round((enemy?.treasury || 700) * 0.45))
    );
    nextNations[playerNationId] = {
      ...playerNation,
      treasury: playerNation.treasury + indemnity,
    };
    if (nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        treasury: Math.max(0, nextNations[enemyId].treasury - indemnity),
      };
    }
    toast = `🪙 ${enemy?.name} devletinden +${indemnity} Altın savaş tazminatı tahsil edildi!`;
  } else if (dealType === 'WHITE_PEACE' && playerWarScore < -35) {
    nextNations[playerNationId] = {
      ...playerNation,
      treasury: Math.max(0, playerNation.treasury - 350),
    };
    toast = `${enemy?.name} ile 350 Altın tazminat ödenerek ateşkes imzalandı.`;
  }

  const curRel = getOrCreateRelation(workingRelations, playerNationId, enemyId);
  const nextRelations = {
    ...workingRelations,
    [key]: {
      ...curRel,
      truceUntilTick: tick + 90,
    },
  };

  return {
    nations: nextNations,
    territories: nextTerritories,
    relations: nextRelations,
    wars: wars.filter((w) => w.id !== warId),
    newsEvents: nextNews,
    toast,
  };
}

export type PeaceConferenceMode = 'PEACE_DEMANDS' | 'WHITE_PEACE' | 'SURRENDER';

export interface PeaceConferenceRequest {
  warId: string;
  mode: PeaceConferenceMode;
  demandedTerritoryIds?: string[];
  fullAnnexation?: boolean;
  demandVassal?: boolean;
  vassalizeEnemy?: boolean;
  demandTribute?: boolean;
  demandReparations?: boolean;
}

export function calculateProvincePeaceScoreCost(
  territory: Territory,
  ownerNation: Nation | undefined,
  isOccupiedByUs: boolean
): number {
  const dev = calculateProvinceDevelopment(territory, ownerNation);
  const baseDevCost = Math.round(
    Math.max(8, Math.min(34, 8 + dev.developmentScore * 0.24))
  );
  const capitalBonus = territory.isCapital ? 8 : 0;
  const rawCost = baseDevCost + capitalBonus;
  // Occupied provinces cost 35% fewer peace points than unoccupied enemy territory
  const discounted = isOccupiedByUs ? Math.round(rawCost * 0.65) : rawCost;
  return Math.max(6, Math.min(42, discounted));
}

export interface WarPeaceBudgetInfo {
  signedWarScore: number;
  occupiedEnemyProvinces: Territory[];
  claimableEnemyProvinces: Territory[];
  availableBudget: number;
  enemyNationId: string;
  isPlayerAttackerSide: boolean;
}

export function calculateWarPeaceBudget(
  war: ActiveWar,
  playerNationId: string,
  territories: Record<string, Territory>,
  explicitEnemyId?: string
): WarPeaceBudgetInfo {
  const isPlayerAttackerSide =
    war.attackerId === playerNationId || war.attackers.includes(playerNationId);
  const enemyNationId =
    explicitEnemyId || (isPlayerAttackerSide ? war.defenderId : war.attackerId);
  const playerSideIds = isPlayerAttackerSide ? war.attackers : war.defenders;
  const enemySideIds = isPlayerAttackerSide ? war.defenders : war.attackers;

  const signedWarScore = isPlayerAttackerSide
    ? war.attackerWarScore
    : -war.attackerWarScore;

  // Claimable enemy provinces: any province currently owned by enemy coalition OR occupied by our coalition from enemy core
  const claimableEnemyProvinces = Object.values(territories).filter((t) => {
    if (!t) return false;
    if (enemySideIds.includes(t.ownerId)) return true;
    if (
      playerSideIds.includes(t.ownerId) &&
      t.isOccupied &&
      (enemySideIds.includes(t.coreOwnerId) || t.coreOwnerId === enemyNationId)
    ) {
      return true;
    }
    return false;
  });

  const occupiedEnemyProvinces = claimableEnemyProvinces.filter(
    (t) => playerSideIds.includes(t.ownerId) && Boolean(t.isOccupied)
  );

  const occupationBonus = occupiedEnemyProvinces.length * 14;
  const totalEnemyOriginalCount = Math.max(1, claimableEnemyProvinces.length);
  const allOccupiedBonus =
    occupiedEnemyProvinces.length >= totalEnemyOriginalCount ? 100 : 0;

  const availableBudget = Math.max(
    0,
    Math.min(
      100,
      Math.max(
        allOccupiedBonus,
        Math.round(Math.max(0, signedWarScore) + occupationBonus)
      )
    )
  );

  return {
    signedWarScore,
    occupiedEnemyProvinces,
    claimableEnemyProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  };
}

export function callAllyToWarDomain(params: {
  warId: string;
  allyNationId: string;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    warId,
    allyNationId,
    playerNationId,
    tick,
    gameMode,
    nations,
    relations,
    wars,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === warId);
  const playerNation = nations[playerNationId];
  const ally = nations[allyNationId];
  if (!war || !playerNation || !ally || ally.isEliminated) return {};

  const isPlayerAttacker =
    war.attackerId === playerNationId || war.attackers.includes(playerNationId);
  const ourSide = isPlayerAttacker ? war.attackers : war.defenders;
  const enemySide = isPlayerAttacker ? war.defenders : war.attackers;

  if (ourSide.includes(allyNationId) || enemySide.includes(allyNationId)) {
    return {
      toast: `${ally.name} zaten bu savaşta yer alıyor.`,
    };
  }

  const rel = getOrCreateRelation(relations, playerNationId, allyNationId);
  const isAlliedOrVassal =
    rel.isAllied ||
    Boolean(rel.allianceType) ||
    ally.vassalOf === playerNationId;
  if (!isAlliedOrVassal) {
    return {
      toast: `🛑 ${ally.name} ile aktif bir ittifak veya paktınız bulunmuyor.`,
    };
  }

  sound.playWarHorn();

  const nextWars = wars.map((w) => {
    if (w.id !== warId) return w;
    return isPlayerAttacker
      ? { ...w, attackers: [...w.attackers, allyNationId] }
      : { ...w, defenders: [...w.defenders, allyNationId] };
  });

  const enemyLeadId = isPlayerAttacker ? war.defenderId : war.attackerId;
  const enemyLead = nations[enemyLeadId];
  const nextRelations = { ...relations };
  for (const enemyId of enemySide) {
    const k = relationKey(allyNationId, enemyId);
    const curRel = getOrCreateRelation(nextRelations, allyNationId, enemyId);
    nextRelations[k] = {
      ...curRel,
      isAllied: false,
      allianceType: null,
      hasNonAggression: false,
      hasTradeAgreement: false,
      score: Math.min(curRel.score, -65),
    };
  }

  const nextNews = prependNews(
    newsEvents,
    tick,
    gameMode,
    `📣 ${ally.name} Savaşa Katıldı`,
    `${ally.name}, müttefiki ${playerNation.name} çağrısına uyarak ${enemyLead?.name || 'karşı koalisyon'} cephesine karşı savaşa girdi.`,
    'WAR'
  );

  return {
    wars: nextWars,
    relations: nextRelations,
    newsEvents: nextNews,
    toast: `📣 Müttefikimiz ${ally.name} savaşa katıldı!`,
  };
}

export function resolvePeaceConferenceDomain(params: {
  request: PeaceConferenceRequest;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles?: unknown[];
  movements?: ArmyMovement[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    request,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === request.warId);
  const playerNation = nations[playerNationId];
  if (!war || !playerNation) return {};

  const budgetInfo = calculateWarPeaceBudget(war, playerNationId, territories);
  const {
    signedWarScore,
    claimableEnemyProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  } = budgetInfo;

  const enemy = nations[enemyNationId];
  if (!enemy) return {};

  const playerSideIds = isPlayerAttackerSide ? war.attackers : war.defenders;
  const enemySideIds = isPlayerAttackerSide ? war.defenders : war.attackers;
  const key = relationKey(playerNationId, enemyNationId);

  const nextNations = { ...nations };
  const nextTerritories = { ...territories };
  let workingRelations = { ...relations };
  let nextNews = newsEvents;

  const effectivePeaceScore =
    signedWarScore >= 0
      ? Math.max(signedWarScore, availableBudget)
      : signedWarScore;

  // 1. WHITE PEACE (Galipsiz Barış) — requires +25 effective war score
  if (request.mode === 'WHITE_PEACE') {
    if (effectivePeaceScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 Savaş ilan edildikten hemen sonra barış yapılamaz! Barış anlaşması için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectivePeaceScore}).`,
      };
    }

    sound.playTreaty();

    // Return any temporarily occupied provinces on both sides to their pre-war core owners
    Object.values(nextTerritories).forEach((t) => {
      if (!t || !t.isOccupied) return;
      if (
        playerSideIds.includes(t.ownerId) &&
        enemySideIds.includes(t.coreOwnerId)
      ) {
        nextTerritories[t.id] = {
          ...t,
          ownerId: t.coreOwnerId,
          isOccupied: false,
          occupiedById: undefined,
        };
      } else if (
        enemySideIds.includes(t.ownerId) &&
        playerSideIds.includes(t.coreOwnerId)
      ) {
        nextTerritories[t.id] = {
          ...t,
          ownerId: t.coreOwnerId,
          isOccupied: false,
          occupiedById: undefined,
        };
      }
    });

    const curRel = getOrCreateRelation(
      workingRelations,
      playerNationId,
      enemyNationId
    );
    workingRelations[key] = {
      ...curRel,
      truceUntilTick: tick + 90,
    };

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${war.name} — Galipsiz Barış`,
      `${playerNation.name} ile ${enemy.name} arasında sınırların korunması şartıyla Galipsiz Barış (Beyaz Barış) imzalandı.`,
      'PEACE'
    );

    return {
      nations: nextNations,
      territories: nextTerritories,
      relations: workingRelations,
      wars: wars.filter((w) => w.id !== war.id),
      newsEvents: nextNews,
      toast: `🕊️ ${enemy.name} ile Galipsiz Barış imzalandı (90 gün ateşkes).`,
    };
  }

  // 2. SURRENDER (Teslim Ol)
  if (request.mode === 'SURRENDER') {
    sound.playDefeat();

    // Enemy keeps any player provinces they occupied; player returns any occupied enemy provinces
    let lostCount = 0;
    Object.values(nextTerritories).forEach((t) => {
      if (!t || !t.isOccupied) return;
      if (
        playerSideIds.includes(t.ownerId) &&
        enemySideIds.includes(t.coreOwnerId)
      ) {
        nextTerritories[t.id] = {
          ...t,
          ownerId: t.coreOwnerId,
          isOccupied: false,
          occupiedById: undefined,
        };
      } else if (
        enemySideIds.includes(t.ownerId) &&
        playerSideIds.includes(t.coreOwnerId)
      ) {
        lostCount++;
        nextTerritories[t.id] = {
          ...t,
          isOccupied: false,
          occupiedById: undefined,
          assimilation: 25,
        };
      }
    });

    const indemnity = Math.round(Math.max(150, playerNation.treasury * 0.3));
    nextNations[playerNationId] = {
      ...playerNation,
      treasury: Math.max(0, playerNation.treasury - indemnity),
      stability: Math.max(15, playerNation.stability - 10),
    };
    nextNations[enemyNationId] = {
      ...enemy,
      treasury: enemy.treasury + indemnity,
    };

    const curRel = getOrCreateRelation(
      workingRelations,
      playerNationId,
      enemyNationId
    );
    workingRelations[key] = {
      ...curRel,
      truceUntilTick: tick + 120,
    };

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${playerNation.name} Ateşkes Şartlarını Kabul Etti`,
      `${playerNation.name}, ${enemy.name} karşısında teslim şartlarını kabul etti (${indemnity} Altın tazminat${lostCount > 0 ? `, ${lostCount} eyalet kaybı` : ''}).`,
      'PEACE'
    );

    return {
      nations: nextNations,
      territories: nextTerritories,
      relations: workingRelations,
      wars: wars.filter((w) => w.id !== war.id),
      newsEvents: nextNews,
      toast: `🏳️ ${enemy.name} ile teslim antlaşması imzalandı (-${indemnity} Altın).`,
    };
  }

  // 3. PEACE_DEMANDS (Savaş Puanı Bütçeli Barış Konferansı — requires +25 effective war score)
  if (effectivePeaceScore < 25) {
    sound.playClick();
    return {
      toast: `🛑 Barış antlaşması imzalamak için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectivePeaceScore}).`,
    };
  }
  const claimableMap = new Map<string, Territory>();
  for (const t of claimableEnemyProvinces) {
    claimableMap.set(t.id, t);
  }

  const demandedIds = request.fullAnnexation
    ? claimableEnemyProvinces.map((t) => t.id)
    : (request.demandedTerritoryIds || []).filter((id) => claimableMap.has(id));

  const isFullAnnex =
    claimableEnemyProvinces.length > 0 &&
    demandedIds.length === claimableEnemyProvinces.length;

  let territoryPointCost = 0;
  for (const id of demandedIds) {
    const terr = claimableMap.get(id)!;
    const isOccupiedByUs =
      playerSideIds.includes(terr.ownerId) && Boolean(terr.isOccupied);
    territoryPointCost += calculateProvincePeaceScoreCost(
      terr,
      enemy,
      isOccupiedByUs
    );
  }
  if (isFullAnnex && territoryPointCost > 100) {
    territoryPointCost = 100;
  }

  const remainingEnemyCount = Math.max(
    0,
    claimableEnemyProvinces.length - demandedIds.length
  );
  const wantVassal =
    Boolean(request.demandVassal || request.vassalizeEnemy) && !isFullAnnex;
  const vassalCost =
    wantVassal && remainingEnemyCount > 0
      ? remainingEnemyCount <= 3
        ? 35
        : 45
      : 0;
  const tributeCost = request.demandTribute ? 20 : 0;
  const reparationsCost = request.demandReparations ? 15 : 0;

  const totalCost =
    territoryPointCost + vassalCost + tributeCost + reparationsCost;

  if (totalCost <= 0) {
    sound.playClick();
    return {
      toast: '🛑 Lütfen barış konferansında en az bir şehir veya antlaşma şartı seçin.',
    };
  }

  if (totalCost > availableBudget) {
    sound.playClick();
    return {
      toast: `🛑 Barış Puanı Bütçesi Aşıldı! Seçilen talepler ${totalCost} Puan tutuyor ancak mevcut bütçeniz ${availableBudget} Puan.`,
    };
  }

  sound.playTreaty();

  const demandedSet = new Set(demandedIds);

  // Transfer demanded provinces to player as permanent non-occupied territories (assimilation 25 if foreign core)
  for (const id of demandedIds) {
    const t = nextTerritories[id];
    if (!t) continue;
    const isCore = t.coreOwnerId === playerNationId;
    nextTerritories[id] = {
      ...t,
      ownerId: playerNationId,
      isCapital: false,
      isOccupied: false,
      occupiedById: undefined,
      assimilation: isCore ? 100 : 25,
      isAssimilating: false,
      unrest: isCore ? Math.max(0, t.unrest - 10) : Math.min(75, t.unrest + 18),
    };
  }

  // Return any occupied enemy provinces that were NOT demanded in the peace deal
  for (const t of claimableEnemyProvinces) {
    if (!demandedSet.has(t.id) && playerSideIds.includes(t.ownerId) && t.isOccupied) {
      nextTerritories[t.id] = {
        ...t,
        ownerId: enemyNationId,
        isOccupied: false,
        occupiedById: undefined,
      };
    }
  }

  const stillOwnedByEnemy = Object.values(nextTerritories).filter(
    (t) => t && t.ownerId === enemyNationId
  );
  const fullAnnexationAchieved = stillOwnedByEnemy.length === 0;

  if (fullAnnexationAchieved) {
    nextNations[enemyNationId] = {
      ...enemy,
      isEliminated: true,
    };
  } else if (
    nextTerritories[enemy.capitalTerritoryId]?.ownerId !== enemyNationId
  ) {
    const newCap = stillOwnedByEnemy[0];
    if (newCap) {
      nextNations[enemyNationId] = {
        ...enemy,
        capitalTerritoryId: newCap.id,
      };
      nextTerritories[newCap.id] = {
        ...newCap,
        isCapital: true,
      };
    }
  }

  let updatedPlayer = { ...playerNation };
  let updatedEnemy = { ...nextNations[enemyNationId] };
  const clauseLabels: string[] = [];

  if (demandedIds.length > 0) {
    clauseLabels.push(
      fullAnnexationAchieved
        ? `Komple İlhak (${demandedIds.length} Şehir)`
        : `${demandedIds.length} Şehir İlhakı`
    );
  }

  if (wantVassal && !fullAnnexationAchieved) {
    updatedEnemy = {
      ...updatedEnemy,
      vassalOf: playerNationId,
    };
    clauseLabels.push('Vasallaştırma');
  }

  if (request.demandTribute) {
    const tributeGold = Math.min(
      650,
      Math.max(250, Math.round((updatedEnemy.treasury || 500) * 0.3))
    );
    updatedPlayer = {
      ...updatedPlayer,
      treasury: updatedPlayer.treasury + tributeGold,
    };
    updatedEnemy = {
      ...updatedEnemy,
      treasury: Math.max(0, updatedEnemy.treasury - tributeGold),
      vassalOf:
        !fullAnnexationAchieved && !updatedEnemy.vassalOf
          ? playerNationId
          : updatedEnemy.vassalOf,
    };
    clauseLabels.push(`Haraç (+${tributeGold} Altın)`);
  }

  if (request.demandReparations) {
    const repGold = Math.min(
      1100,
      Math.max(350, Math.round((updatedEnemy.treasury || 650) * 0.45))
    );
    updatedPlayer = {
      ...updatedPlayer,
      treasury: updatedPlayer.treasury + repGold,
    };
    updatedEnemy = {
      ...updatedEnemy,
      treasury: Math.max(0, updatedEnemy.treasury - repGold),
    };
    clauseLabels.push(`Tazminat (+${repGold} Altın)`);
  }

  const aeRaw =
    demandedIds.length * 4.5 +
    (fullAnnexationAchieved ? 8 : 0) +
    (wantVassal ? 6 : 0);
  if (aeRaw > 0) {
    updatedPlayer = {
      ...updatedPlayer,
      aggressiveExpansion: Math.min(
        100,
        updatedPlayer.aggressiveExpansion +
          adjustAggressiveExpansionGain(updatedPlayer, aeRaw)
      ),
    };
  }

  nextNations[playerNationId] = updatedPlayer;
  nextNations[enemyNationId] = updatedEnemy;

  if (demandedIds.length > 0 || wantVassal) {
    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyNationId,
      provincesTakenCount: Math.max(1, demandedIds.length),
      isFullAnnexation: fullAnnexationAchieved,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;
  }

  const curRel = getOrCreateRelation(
    workingRelations,
    playerNationId,
    enemyNationId
  );
  workingRelations[key] = {
    ...curRel,
    truceUntilTick: tick + 120,
  };

  const summaryStr = clauseLabels.join(', ');
  nextNews = prependNews(
    newsEvents,
    tick,
    gameMode,
    `📜 ${war.name} Barış Konferansı`,
    `${playerNation.name} ile ${enemy.name} arasında barış antlaşması imzalandı: ${summaryStr}.`,
    'PEACE'
  );

  return {
    nations: nextNations,
    territories: nextTerritories,
    relations: workingRelations,
    wars: wars.filter((w) => w.id !== war.id),
    newsEvents: nextNews,
    toast: `📜 ${enemy.name} ile Barış İmzalandı: ${summaryStr}`,
  };
}

export function calculateVassalAnnexCost(
  vassalNationId: string,
  territories: Record<string, Territory>
): number {
  const provCount = Object.values(territories).filter(
    (t) => t && t.ownerId === vassalNationId
  ).length;
  return Math.min(1200, 350 + Math.max(1, provCount) * 150);
}

export function calculateProvincePurchasePrice(
  territory: Territory,
  sellerNation: Nation | undefined,
  relationScore: number
): number {
  const dev = calculateProvinceDevelopment(territory, sellerNation);
  const bld = territory.buildings || {
    factory: 0,
    barracks: 0,
    fortress: 0,
    university: 0,
    tradeHub: 0,
    supplyDepot: 0,
    shipyard: 0,
    mint: 0,
    granary: 0,
  };
  const econValue =
    (bld.factory || 0) * 140 +
    (bld.tradeHub || 0) * 140 +
    (bld.shipyard || 0) * 130 +
    (bld.mint || 0) * 120 +
    (bld.university || 0) * 110;
  const rawBase = 480 + dev.developmentScore * 14 + econValue;
  const relMult =
    relationScore >= 45
      ? 0.85
      : relationScore >= 20
      ? 0.94
      : relationScore < 0
      ? 1.25
      : 1.0;
  const rounded = Math.round((rawBase * relMult) / 50) * 50;
  return Math.max(450, Math.min(4200, rounded));
}

export function canAcceptLandPurchase(params: {
  territory: Territory;
  sellerNation: Nation | undefined;
  sellerPersonality: AiPersonality;
  relationScore: number;
  sellerProvCount: number;
}): { willAccept: boolean; reason: string; score: number } {
  const {
    territory,
    sellerNation,
    sellerPersonality,
    relationScore,
    sellerProvCount,
  } = params;

  if (!sellerNation || sellerNation.isEliminated) {
    return { willAccept: false, reason: 'Devlet mevcut değil.', score: -100 };
  }
  if (territory.isCapital || sellerProvCount <= 1) {
    return {
      willAccept: false,
      reason: 'Başkent veya son eyalet satılamaz.',
      score: -100,
    };
  }

  const meta = AI_PERSONALITY_META[sellerPersonality];
  const isForeignCore = territory.coreOwnerId !== territory.ownerId;
  let score = relationScore + meta.landSaleWillingness;
  if (isForeignCore) score += 25;
  else score -= 8;
  if (sellerNation.treasury < 750) score += 18;
  if (sellerProvCount >= 6) score += 12;
  if ((territory.baseGdp || 0) >= 120) score -= 14;

  if (score >= 22) {
    return {
      willAccept: true,
      reason: `${sellerNation.name} (${meta.shortLabel}) teklife olumlu bakıyor.`,
      score,
    };
  }
  return {
    willAccept: false,
    reason:
      relationScore < 20
        ? `İlişki düşük (${relationScore}); önce ilişkileri geliştirin.`
        : `${sellerNation.name} (${meta.shortLabel}) bu eyaleti stratejik görüyor.`,
    score,
  };
}

export function evaluateLandPurchaseDomain(params: {
  territoryId: string;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    territoryId,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    newsEvents,
  } = params;

  const terr = territories[territoryId];
  const player = nations[playerNationId];
  if (!terr || !player || terr.ownerId === playerNationId) return {};

  const sellerId = terr.ownerId;
  const seller = nations[sellerId];
  if (!seller || seller.isEliminated) return {};

  if (isAtWar(wars, playerNationId, sellerId)) {
    return { toast: 'Savaş halindeki bir devletten toprak satın alınamaz.' };
  }

  const bordersPlayer = terr.neighbors.some(
    (nId) => territories[nId]?.ownerId === playerNationId
  );
  if (!bordersPlayer) {
    return {
      toast: `${terr.name} eyaletini satın almak için sınır komşuluğu gerekir.`,
    };
  }

  const sellerProvs = Object.values(territories).filter(
    (t) => t && t.ownerId === sellerId
  );
  const relKey = relationKey(playerNationId, sellerId);
  const rel = getOrCreateRelation(relations, playerNationId, sellerId);
  const sellerPersonality = resolveNationAiPersonality(seller, territories);

  const check = canAcceptLandPurchase({
    territory: terr,
    sellerNation: seller,
    sellerPersonality,
    relationScore: rel.score,
    sellerProvCount: sellerProvs.length,
  });

  if (!check.willAccept) {
    sound.playClick();
    return {
      toast: `${seller.name} ${terr.name} satışını reddetti: ${check.reason}`,
    };
  }

  const price = calculateProvincePurchasePrice(terr, seller, rel.score);
  if (player.treasury < price) {
    return {
      toast: `${terr.name} eyaletini satın almak için ${price.toLocaleString('tr-TR')} Altın gerekli.`,
    };
  }

  const spent = spendDiplomacyPoints(player, 15);
  if ('error' in spent) return { toast: spent.error };

  sound.playTreaty();
  const nextTerritories: Record<string, Territory> = { ...territories };

  // Relocate seller's garrison to seller's capital or another seller province
  const fallbackSellerProv =
    (seller.capitalTerritoryId &&
    seller.capitalTerritoryId !== terr.id &&
    nextTerritories[seller.capitalTerritoryId]?.ownerId === sellerId
      ? nextTerritories[seller.capitalTerritoryId]
      : sellerProvs.find((p) => p.id !== terr.id)) || null;

  if (fallbackSellerProv && terr.garrison > 0) {
    nextTerritories[fallbackSellerProv.id] = {
      ...fallbackSellerProv,
      garrison: fallbackSellerProv.garrison + terr.garrison,
      units: {
        infantry:
          (fallbackSellerProv.units?.infantry || fallbackSellerProv.garrison) +
          (terr.units?.infantry || terr.garrison),
        armor:
          (fallbackSellerProv.units?.armor || 0) + (terr.units?.armor || 0),
        airDrone:
          (fallbackSellerProv.units?.airDrone || 0) +
          (terr.units?.airDrone || 0),
      },
    };
  }

  const isPlayerCore = terr.coreOwnerId === playerNationId;
  nextTerritories[terr.id] = {
    ...terr,
    ownerId: playerNationId,
    isCapital: false,
    isOccupied: false,
    occupiedById: undefined,
    siege: null,
    garrison: 500,
    units: { infantry: 500, armor: 0, airDrone: 0 },
    assimilation: isPlayerCore ? 100 : 45,
    isAssimilating: false,
    unrest: isPlayerCore ? 0 : 12,
  };

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...spent.nation,
        treasury: spent.nation.treasury - price,
      },
      [sellerId]: {
        ...seller,
        treasury: seller.treasury + price,
      },
    },
    territories: nextTerritories,
    relations: {
      ...relations,
      [relKey]: {
        ...rel,
        score: Math.min(100, rel.score + 10),
      },
    },
    newsEvents: prependNews(
      newsEvents,
      tick,
      gameMode,
      `🪙 Toprak Satın Alma: ${terr.name}`,
      `${player.name}, ${price.toLocaleString('tr-TR')} Altın karşılığında ${seller.name} devletinden ${terr.name} eyaletini barışçıl yolla satın aldı.`,
      'ECONOMY'
    ),
    toast: `🪙 ${terr.name} eyaleti ${price.toLocaleString('tr-TR')} Altın karşılığında barışçıl olarak satın alındı (+10 İlişki)!`,
  };
}

export function issueProvinceUltimatumDomain(params: {
  territoryId: string;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    territoryId,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    newsEvents,
  } = params;

  const terr = territories[territoryId];
  const player = nations[playerNationId];
  if (!terr || !player || terr.ownerId === playerNationId) return {};

  const targetId = terr.ownerId;
  const target = nations[targetId];
  if (!target || target.isEliminated) return {};

  const bordersPlayer = terr.neighbors.some(
    (nId) => territories[nId]?.ownerId === playerNationId
  );
  if (!bordersPlayer) {
    return {
      toast: `${terr.name} için toprak ültimatomu vermeye sınır komşuluğu gerekir.`,
    };
  }

  if (isAtWar(wars, playerNationId, targetId)) {
    return { toast: 'Zaten savaş halindesiniz; toprak talebi için Barış Konferansını kullanın.' };
  }

  const relKey = relationKey(playerNationId, targetId);
  const rel = getOrCreateRelation(relations, playerNationId, targetId);
  if (rel.isAllied || rel.allianceType || rel.hasNonAggression) {
    return {
      toast: `🛑 ${target.name} ile ittifak veya saldırmazlık paktı varken toprak ültimatomu verilemez.`,
    };
  }
  if (rel.truceUntilTick > tick) {
    const rem = Math.max(1, rel.truceUntilTick - tick);
    return {
      toast: `🛑 ${target.name} ile ateşkes sürüyor (${rem} gün kaldı).`,
    };
  }

  const spent = spendDiplomacyPoints(player, 25);
  if ('error' in spent) return { toast: spent.error };

  const allTerrs = Object.values(territories);
  const playerArmy = allTerrs
    .filter((t) => t && t.ownerId === playerNationId)
    .reduce((sum, t) => sum + t.garrison, 0);
  const targetProvs = allTerrs.filter((t) => t && t.ownerId === targetId);
  const targetArmy = targetProvs.reduce((sum, t) => sum + t.garrison, 0);

  // Include 35% of target's defensive allies' armies as deterrence
  let allyArmy = 0;
  for (const other of Object.values(nations)) {
    if (
      !other ||
      other.isEliminated ||
      other.id === playerNationId ||
      other.id === targetId
    ) {
      continue;
    }
    const r = getOrCreateRelation(relations, targetId, other.id);
    if (r.isAllied || r.allianceType) {
      allyArmy += allTerrs
        .filter((t) => t && t.ownerId === other.id)
        .reduce((s, t) => s + t.garrison, 0);
    }
  }

  const effectiveTargetStrength = Math.max(
    4500,
    targetArmy + Math.round(allyArmy * 0.35)
  );
  const targetPersonality = resolveNationAiPersonality(target, territories);
  const meta = AI_PERSONALITY_META[targetPersonality];
  const capitalMod = terr.isCapital || targetProvs.length <= 1 ? 0.45 : 0;
  const requiredRatio = Number(
    (1.75 * meta.ultimatumResistance + capitalMod).toFixed(2)
  );

  if (playerArmy >= effectiveTargetStrength * requiredRatio) {
    sound.playTreaty();
    const nextTerritories: Record<string, Territory> = { ...territories };
    const nextNations: Record<string, Nation> = { ...nations };

    const remainingTargetProvs = targetProvs.filter((p) => p.id !== terr.id);
    if (remainingTargetProvs.length > 0 && terr.garrison > 0) {
      const retreatProv = remainingTargetProvs[0];
      nextTerritories[retreatProv.id] = {
        ...retreatProv,
        garrison: retreatProv.garrison + terr.garrison,
        units: {
          infantry:
            (retreatProv.units?.infantry || retreatProv.garrison) +
            (terr.units?.infantry || terr.garrison),
          armor:
            (retreatProv.units?.armor || 0) + (terr.units?.armor || 0),
          airDrone:
            (retreatProv.units?.airDrone || 0) + (terr.units?.airDrone || 0),
        },
      };
    }

    const isCore = terr.coreOwnerId === playerNationId;
    nextTerritories[terr.id] = {
      ...terr,
      ownerId: playerNationId,
      isCapital: false,
      isOccupied: false,
      occupiedById: undefined,
      siege: null,
      garrison: 1000,
      units: { infantry: 1000, armor: 0, airDrone: 0 },
      assimilation: isCore ? 100 : 25,
      isAssimilating: false,
      unrest: isCore ? 5 : 24,
    };

    const fullCollapse = remainingTargetProvs.length === 0;
    if (fullCollapse) {
      nextNations[targetId] = { ...target, isEliminated: true };
    } else if (target.capitalTerritoryId === terr.id) {
      const newCap = remainingTargetProvs[0];
      nextNations[targetId] = { ...target, capitalTerritoryId: newCap.id };
      nextTerritories[newCap.id] = {
        ...nextTerritories[newCap.id],
        isCapital: true,
      };
    }

    nextNations[playerNationId] = {
      ...spent.nation,
      aggressiveExpansion: Math.min(
        100,
        spent.nation.aggressiveExpansion +
          adjustAggressiveExpansionGain(spent.nation, 8)
      ),
    };

    const penalty = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: targetId,
      provincesTakenCount: 1,
      isFullAnnexation: fullCollapse,
      nations: nextNations,
      relations,
    });

    const updatedRelations: Record<string, DiplomaticRelation> = {
      ...penalty.updatedRelations,
      [relKey]: {
        ...getOrCreateRelation(penalty.updatedRelations, playerNationId, targetId),
        score: Math.max(-100, rel.score - 30),
        truceUntilTick: tick + 60,
      },
    };

    return {
      nations: nextNations,
      territories: nextTerritories,
      relations: updatedRelations,
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `📜 Toprak Ültimatomu Kabul Edildi: ${terr.name}`,
        `${target.name}, ${player.name} ordusunun ezici üstünlüğü karşısında savaşmadan ${terr.name} eyaletini devretti.`,
        'PEACE'
      ),
      toast: `📜 ${target.name} ültimatomu kabul etti! ${terr.name} savaşmadan sınırlarımıza katıldı.`,
    };
  }

  sound.playWarHorn();
  return {
    nations: { ...nations, [playerNationId]: spent.nation },
    relations: {
      ...relations,
      [relKey]: {
        ...rel,
        score: Math.max(-100, rel.score - 35),
      },
    },
    newsEvents: prependNews(
      newsEvents,
      tick,
      gameMode,
      `⚠️ Ültimatom Reddedildi: ${target.name}`,
      `${target.name}, ${player.name} hükümetinin ${terr.name} üzerindeki toprak ültimatomunu reddetti!`,
      'WAR'
    ),
    toast: `⚠️ ${target.name} (${meta.shortLabel}) ${terr.name} ültimatomunu reddetti (-35 İlişki; en az ${requiredRatio}x güç üstünlüğü gerekir).`,
  };
}

export function respondToDiplomaticOfferDomain(params: {
  offer: IncomingDiplomaticOffer;
  accept: boolean;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    offer,
    accept,
    playerNationId,
    tick,
    gameMode,
    nations,
    relations,
    wars,
    newsEvents,
  } = params;

  const sender = nations[offer.fromNationId];
  const player = nations[playerNationId];
  if (!sender || !player || sender.isEliminated) {
    return { toast: 'Teklif gönderen devlet artık mevcut değil.' };
  }

  const key = relationKey(playerNationId, offer.fromNationId);
  const rel = getOrCreateRelation(relations, playerNationId, offer.fromNationId);

  if (!accept) {
    sound.playClick();
    return {
      relations: {
        ...relations,
        [key]: {
          ...rel,
          score: Math.max(-100, rel.score - 5),
        },
      },
      toast: `${sender.name} diplomatik teklifi reddedildi (-5 İlişki).`,
    };
  }

  if (isAtWar(wars, playerNationId, offer.fromNationId)) {
    return { toast: 'Savaş halindeki bir devletin diplomatik teklifi onaylanamaz.' };
  }

  sound.playTreaty();

  if (offer.kind === 'TRADE') {
    return {
      relations: {
        ...relations,
        [key]: {
          ...rel,
          hasTradeAgreement: true,
          hasEmbargo: false,
          embargoingNationIds: [],
          score: Math.min(100, rel.score + 10),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🤝 Ticaret Anlaşması: ${player.name} - ${sender.name}`,
        `${player.name}, ${sender.name} tarafından sunulan Serbest Ticaret Anlaşmasını onayladı.`,
        'ECONOMY'
      ),
      toast: `🤝 ${sender.name} ile Serbest Ticaret Anlaşması yürürlüğe girdi (+10 İlişki)!`,
    };
  }

  if (offer.kind === 'NON_AGGRESSION') {
    return {
      relations: {
        ...relations,
        [key]: {
          ...rel,
          hasNonAggression: true,
          score: Math.min(100, rel.score + 10),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🕊️ Saldırmazlık Paktı: ${player.name} - ${sender.name}`,
        `${player.name} ve ${sender.name} karşılıklı Saldırmazlık Paktı imzaladı.`,
        'PEACE'
      ),
      toast: `🕊️ ${sender.name} ile Saldırmazlık Paktı imzalandı (+10 İlişki)!`,
    };
  }

  if (offer.kind === 'DEFENSIVE_PACT') {
    return {
      relations: {
        ...relations,
        [key]: {
          ...rel,
          isAllied: true,
          allianceType: 'DEFENSIVE',
          hasMilitaryAccess: true,
          score: Math.min(100, rel.score + 15),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `🛡️ Savunma Paktı: ${player.name} - ${sender.name}`,
        `${player.name} ve ${sender.name} ortak tehditlere karşı Karşılıklı Savunma Paktı kurdu.`,
        'PEACE'
      ),
      toast: `🛡️ ${sender.name} ile Savunma Paktı imzalandı (+15 İlişki)!`,
    };
  }

  if (offer.kind === 'MILITARY_ACCESS') {
    return {
      relations: {
        ...relations,
        [key]: {
          ...rel,
          hasMilitaryAccess: true,
          score: Math.min(100, rel.score + 8),
        },
      },
      toast: `🪖 ${sender.name} ile Askeri Geçiş Anlaşması onaylandı (+8 İlişki).`,
    };
  }

  // TRIBUTE_GIFT
  const gift = Math.max(120, Math.min(sender.treasury, offer.goldGift || 250));
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...player,
        treasury: player.treasury + gift,
      },
      [offer.fromNationId]: {
        ...sender,
        treasury: Math.max(0, sender.treasury - gift),
      },
    },
    relations: {
      ...relations,
      [key]: {
        ...rel,
        score: Math.min(100, rel.score + 12),
      },
    },
    newsEvents: prependNews(
      newsEvents,
      tick,
      gameMode,
      `🪙 Diplomatik Hediye: ${sender.name}`,
      `${sender.name}, iyi niyet göstergesi olarak ${player.name} hazinesine +${gift} Altın gönderdi.`,
      'ECONOMY'
    ),
    toast: `🪙 ${sender.name} diplomatik hediyesi kabul edildi (+${gift} Altın, +12 İlişki)!`,
  };
}


