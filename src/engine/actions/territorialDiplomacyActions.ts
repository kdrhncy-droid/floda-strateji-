import {
  ActiveWar,
  AiPersonality,
  DiplomaticRelation,
  GameModeId,
  IncomingDiplomaticOffer,
  Nation,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  applyConquestDiplomaticPenalty,
  getOrCreateRelation,
  isAtWar,
  relationKey,
} from '../core/diplomacyHelpers';
import {
  adjustAggressiveExpansionGain,
  calculateProvinceDevelopment,
} from '../simulationEngine';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from '../seasonSupplyAndAiProfile';
import { sound } from '../../utils/soundEngine';
import {
  DomainActionPatch,
  spendDiplomacyPoints,
  prependNews,
} from './diplomacyActionHelpers';

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



