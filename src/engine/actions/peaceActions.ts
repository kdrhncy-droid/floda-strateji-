import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  PeaceDealType,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  applyConquestDiplomaticPenalty,
  getOrCreateRelation,
  relationKey,
} from '../core/diplomacyHelpers';
import {
  adjustAggressiveExpansionGain,
  calculateProvinceDevelopment,
} from '../simulationEngine';
import { sound } from '../../utils/soundEngine';
import {
  DomainActionPatch,
  prependNews,
} from './diplomacyActionHelpers';

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
