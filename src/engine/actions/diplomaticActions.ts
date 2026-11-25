import {
  ActiveWar,
  ArmyMovement,
  DiplomaticActionType,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  applyConquestDiplomaticPenalty,
  evaluateWorldCoalitionAt100AE,
  getEmbargoingNationIds,
  getOrCreateRelation,
  isAtWar,
  relationKey,
  WAR_DECLARATION_BASE_AE,
} from '../core/diplomacyHelpers';
import {
  adjustAggressiveExpansionGain,
  resolveWarParticipants,
} from '../simulationEngine';
import { evaluateWartimeAiOperations } from '../aiAndRebellionEngine';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from '../seasonSupplyAndAiProfile';
import { sound } from '../../utils/soundEngine';
import {
  DomainActionPatch,
  DIPLOMACY_POINT_COSTS,
  spendDiplomacyPoints,
  prependNews,
} from './diplomacyActionHelpers';

export function calculateVassalAnnexCost(
  vassalNationId: string,
  territories: Record<string, Territory>
): number {
  const provCount = Object.values(territories).filter(
    (t) => t && t.ownerId === vassalNationId
  ).length;
  return Math.min(1200, 350 + Math.max(1, provCount) * 150);
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
  calledAllyIds?: string[];
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
    calledAllyIds,
  } = params;

  const playerNation = nations[playerNationId];
  const target = nations[targetNationId];
  if (!playerNation || !target) return {};

  const key = relationKey(playerNationId, targetNationId);
  const currentRel = getOrCreateRelation(relations, playerNationId, targetNationId);

  if (action === 'IMPROVE') {
    if (isAtWar(wars, playerNationId, targetNationId)) {
      return { toast: `${target.name} ile savaş halindeyken elçilik heyeti gönderilemez.` };
    }
    if (currentRel.score >= 100) {
      return { toast: `${target.name} ile ilişkileriniz zaten en üst seviyede (+100).` };
    }
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
      startEnvoy: {
        targetNationId,
        mission: 'IMPROVE',
        dailyDelta: 3,
        daysRemaining: 10,
        totalDays: 10,
        startScore: currentRel.score,
      },
      toast: `🕊️ ${target.name} başkentine Elçi Heyeti gönderildi (10 gün boyunca günde +3 İlişki).`,
    };
  }

  if (action === 'DAMAGE') {
    if (currentRel.score <= -100) {
      return { toast: `${target.name} ile ilişkiler zaten en düşük seviyede (-100).` };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.DAMAGE || 5
    );
    if ('error' in spent) return { toast: spent.error };
    sound.playClick();
    return {
      nations: {
        ...nations,
        [playerNationId]: spent.nation,
      },
      startEnvoy: {
        targetNationId,
        mission: 'DAMAGE',
        dailyDelta: -3,
        daysRemaining: 10,
        totalDays: 10,
        startScore: currentRel.score,
      },
      toast: `⚡ ${target.name} ile ilişkileri düşürme süreci başlatıldı (10 gün boyunca günde -3 İlişki).`,
    };
  }

  if (action === 'INSULT') {
    const lastInsultTick = playerNation.lastInsultTickByNation?.[targetNationId];
    if (typeof lastInsultTick === 'number' && tick - lastInsultTick < 5) {
      const remDays = Math.max(1, 5 - (tick - lastInsultTick));
      return {
        toast: `⏳ ${target.name} devletine tekrar sert nota/hakaret göndermek için ${remDays} gün beklemelisiniz.`,
      };
    }
    const spent = spendDiplomacyPoints(
      playerNation,
      DIPLOMACY_POINT_COSTS.INSULT || 0
    );
    if ('error' in spent) return { toast: spent.error };
    sound.playWarHorn();
    const updatedInsultNation: Nation = {
      ...spent.nation,
      prestige: Math.min(100, Number(((spent.nation.prestige ?? 10) + 1).toFixed(1))),
      lastInsultTickByNation: {
        ...(spent.nation.lastInsultTickByNation || {}),
        [targetNationId]: tick,
      },
    };
    return {
      nations: { ...nations, [playerNationId]: updatedInsultNation },
      relations: {
        ...relations,
        [key]: {
          ...currentRel,
          isAllied: false,
          allianceType: null,
          hasNonAggression: false,
          score: Math.max(-100, currentRel.score - 30),
        },
      },
      newsEvents: prependNews(
        newsEvents,
        tick,
        gameMode,
        `Diplomatik Gerilim: ${playerNation.name} - ${target.name}`,
        `${playerNation.name} Dışişleri, ${target.name} sarayına ağır hakaret içeren bir nota gönderdi (-30 İlişki).`,
        'WAR'
      ),
      toast: `💢 ${target.name} hükümetine sert diplomatik hakaret gönderildi (-30 İlişki, +1 Prestij).`,
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
      nations,
      calledAllyIds
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
      warDesc += ` Çağrılan müttefikleriniz (${attAllyNames.join(', ')}) ortak taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Hedefin ittifak ortakları (${defAllyNames.join(', ')}) savunmaya katıldı!`;
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

    const warAeGain = adjustAggressiveExpansionGain(
      spent.nation,
      WAR_DECLARATION_BASE_AE
    );
    const playerAfterWarAe: Nation = {
      ...spent.nation,
      aggressiveExpansion: Math.min(
        100,
        Number(((spent.nation.aggressiveExpansion || 0) + warAeGain).toFixed(1))
      ),
    };

    const baseToast =
      defAllyNames.length > 0
        ? `⚔️ ${target.name} ile savaş başladı (+${warAeGain} Agresiflik, Savunma İttifakı: ${defAllyNames.join(', ')})`
        : attAllyNames.length > 0
        ? `⚔️ ${target.name} ile savaş başladı (+${warAeGain} Agresiflik, Müttefik: ${attAllyNames.join(', ')})`
        : `⚔️ ${target.name} devletine savaş ilan edildi (+${warAeGain} Agresiflik)!`;
    const nextNations = {
      ...(aiCounter?.updatedNations || nations),
      [playerNationId]: playerAfterWarAe,
    };

    const coalitionRes = evaluateWorldCoalitionAt100AE({
      targetNationId: playerNationId,
      nations: nextNations,
      territories: aiCounter?.updatedTerritories || territories,
      relations: nextRelations,
      wars: nextWars,
      tick,
      gameMode,
      newsEvents: updatedNews,
      playerNationId,
    });

    const primaryAnnouncement = coalitionRes.warAnnouncement || {
      id: newWar.id,
      warId: newWar.id,
      warName: newWar.name,
      attackerId: playerNationId,
      attackerName: playerNation.name,
      attackerFlagCode: playerNation.flagCode,
      attackerColor: playerNation.color,
      defenderId: targetNationId,
      defenderName: target.name,
      defenderFlagCode: target.flagCode,
      defenderColor: target.color,
      isPlayerAttacker: true,
      isPlayerDefender: false,
      alliesJoinedNames: [...attAllyNames, ...defAllyNames],
      createdAtMs: Date.now(),
    };

    return {
      nations: nextNations,
      ...(aiCounter?.updatedTerritories
        ? { territories: aiCounter.updatedTerritories }
        : {}),
      ...(aiCounter?.newMovements?.length
        ? { movements: [...movements, ...aiCounter.newMovements] }
        : {}),
      wars: coalitionRes.wars,
      relations: coalitionRes.relations,
      newsEvents: coalitionRes.newsEvents,
      warAnnouncement: primaryAnnouncement,
      toast: coalitionRes.triggered && coalitionRes.toast ? coalitionRes.toast : baseToast,
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
    const currentWallHp = bestFortProv.castleWallHp ?? 100;
    const nextWallHp = Math.min(currentWallHp, Math.min(35, Math.max(15, currentWallHp - 55)));
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

    const availableTreasury = Math.max(0, target.treasury ?? 0);
    const stolenGold = Math.min(
      availableTreasury,
      Math.min(520, Math.max(210, Math.round(availableTreasury * 0.22)))
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
