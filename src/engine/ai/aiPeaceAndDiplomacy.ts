import {
  ActiveWar,
  AiPersonality,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  IncomingDiplomaticOffer,
  Nation,
  Territory,
} from '../../types/game';
import { AiAggressivenessLevel } from '../gameSettings';
import { AI_PERSONALITY_META } from '../seasonSupplyAndAiProfile';
import {
  getEmbargoingNationIds,
  getOrCreateRelation,
  isAtWar,
  resolveWarParticipants,
} from '../simulationEngine';
import { relationKey } from '../worldBuilder';
import {
  AiTurnResult,
  AllianceCompatibilityResult,
  computeRealmTotalTroops,
  seededHash,
  seededShuffle,
} from './aiSharedUtils';

/**
 * Scores geopolitical alliance compatibility between two nations and enforces
 * hard diplomatic guardrails (no allying with war enemies, embargoers,
 * vassals, or allies of our active war enemies).
 */
export function computeAllianceCompatibilityScore(params: {
  actor: Nation;
  peer: Nation;
  rel: DiplomaticRelation;
  wars: ActiveWar[];
  relations: Record<string, DiplomaticRelation>;
  nations: Record<string, Nation>;
  gameMode: GameModeId;
  threatNeighborIds: string[];
  actorPersonality?: string;
  isDirectNeighbor?: boolean;
  peerOwnsActorCore?: boolean;
}): AllianceCompatibilityResult {
  const {
    actor,
    peer,
    rel,
    wars,
    relations,
    nations,
    gameMode,
    threatNeighborIds,
    actorPersonality,
    isDirectNeighbor = false,
    peerOwnsActorCore = false,
  } = params;

  const zeroBlocked: AllianceCompatibilityResult = {
    blocked: true,
    score: -100,
    sharesCommonWarEnemy: false,
    sharesCommonThreat: false,
  };

  if (
    !actor ||
    !peer ||
    actor.id === peer.id ||
    actor.isEliminated ||
    peer.isEliminated
  ) {
    return zeroBlocked;
  }

  // Hard guardrails: active war, embargo, vassalage, or deep hatred
  if (isAtWar(wars, actor.id, peer.id)) return zeroBlocked;
  if (rel.hasEmbargo || getEmbargoingNationIds(rel).length > 0) {
    return zeroBlocked;
  }
  if (actor.vassalOf || peer.vassalOf) return zeroBlocked;
  if (rel.score <= -25) return zeroBlocked;

  // Never ally with a nation that is allied to one of our active war enemies (or vice versa)
  const actorEnemies = new Set<string>();
  const peerEnemies = new Set<string>();
  for (const w of wars) {
    if (w.attackers.includes(actor.id)) {
      w.defenders.forEach((id) => actorEnemies.add(id));
    } else if (w.defenders.includes(actor.id)) {
      w.attackers.forEach((id) => actorEnemies.add(id));
    }
    if (w.attackers.includes(peer.id)) {
      w.defenders.forEach((id) => peerEnemies.add(id));
    } else if (w.defenders.includes(peer.id)) {
      w.attackers.forEach((id) => peerEnemies.add(id));
    }
  }

  for (const enemyId of actorEnemies) {
    const peerRelToEnemy = getOrCreateRelation(relations, peer.id, enemyId);
    if (peerRelToEnemy.isAllied || Boolean(peerRelToEnemy.allianceType)) {
      return zeroBlocked;
    }
  }
  for (const enemyId of peerEnemies) {
    const actorRelToEnemy = getOrCreateRelation(relations, actor.id, enemyId);
    if (actorRelToEnemy.isAllied || Boolean(actorRelToEnemy.allianceType)) {
      return zeroBlocked;
    }
  }

  let sharesCommonWarEnemy = false;
  for (const enemyId of actorEnemies) {
    if (peerEnemies.has(enemyId)) {
      sharesCommonWarEnemy = true;
      break;
    }
  }

  const sharesCommonThreat = threatNeighborIds.some((threatId) => {
    if (threatId === peer.id) return false;
    const peerRelToThreat = getOrCreateRelation(relations, peer.id, threatId);
    return (
      peerRelToThreat.score <= -15 ||
      (nations[threatId]?.aggressiveExpansion ?? 0) >= 35
    );
  });

  let score = rel.score * 0.75;
  if (sharesCommonWarEnemy) score += 32;
  if (sharesCommonThreat) score += 20;

  // Shared faith (stronger in 1440 historical era)
  if (actor.stateReligion && peer.stateReligion) {
    if (actor.stateReligion === peer.stateReligion) {
      score += gameMode === 'EMPIRES_1440' ? 12 : 4;
    } else if (gameMode === 'EMPIRES_1440') {
      score -= 6;
    }
  }

  // Ideology alignment (stronger in 2026 modern era)
  if (actor.ideology === peer.ideology) {
    score += gameMode !== 'EMPIRES_1440' ? 10 : 5;
  } else if (
    (actor.ideology === 'DEMOCRACY' &&
      (peer.ideology === 'AUTHORITARIAN' ||
        peer.ideology === 'MILITARY_JUNTA')) ||
    ((actor.ideology === 'AUTHORITARIAN' ||
      actor.ideology === 'MILITARY_JUNTA') &&
      peer.ideology === 'DEMOCRACY')
  ) {
    score -= 8;
  }

  // Existing diplomatic warmth & trust
  if (rel.hasTradeAgreement) score += 8;
  if (rel.hasNonAggression) score += 8;
  if (rel.hasMilitaryAccess) score += 4;

  // Aggressive expansion deterrence
  if ((peer.aggressiveExpansion || 0) >= 45) score -= 28;
  else if ((peer.aggressiveExpansion || 0) >= 30) score -= 14;

  // Border ambition / revanchist friction
  if (peerOwnsActorCore) score -= 24;
  if (
    isDirectNeighbor &&
    (actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST') &&
    !sharesCommonThreat
  ) {
    score -= 8;
  }

  return {
    blocked: false,
    score: Math.round(score),
    sharesCommonWarEnemy,
    sharesCommonThreat,
  };
}

/**
 * Step 4B: Proactive AI-to-AI diplomacy, border friction, embargoes, and AI-to-Player live offers.
 */
export function evaluateAiDiplomacyAndOffers(params: {
  actorId: string;
  actorNation: Nation;
  playerNationId: string;
  ownedProvinces: Territory[];
  activeTerrs: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  nextTick: number;
  stepIndex: number;
  gameMode: GameModeId;
  actorPersonality: AiPersonality;
  hasActiveIncomingOffer: boolean;
  worldSeed?: number;
}): {
  updatedRelations?: Record<string, DiplomaticRelation>;
  diploNewsItem?: AiTurnResult['newsItem'];
  incomingOffer?: IncomingDiplomaticOffer;
} {
  const {
    actorId,
    actorNation,
    playerNationId,
    ownedProvinces,
    activeTerrs,
    nations,
    relations,
    wars,
    movements,
    nextTick,
    stepIndex,
    gameMode,
    actorPersonality,
    hasActiveIncomingOffer,
    worldSeed,
  } = params;

  const personalityMeta = AI_PERSONALITY_META[actorPersonality];
  let updatedRelations: Record<string, DiplomaticRelation> | undefined;
  let diploNewsItem: AiTurnResult['newsItem'] | undefined;
  let incomingOffer: IncomingDiplomaticOffer | undefined;

  const neighborIds = new Set<string>();
  const regionalIds = new Set<string>();
  for (const p of ownedProvinces) {
    for (const nId of p.neighbors) {
      const nbTerr = activeTerrs[nId];
      const nbOwner = nbTerr?.ownerId;
      if (nbOwner && nbOwner !== actorId) {
        neighborIds.add(nbOwner);
        for (const hop2Id of nbTerr.neighbors) {
          const hop2Owner = activeTerrs[hop2Id]?.ownerId;
          if (hop2Owner && hop2Owner !== actorId && !neighborIds.has(hop2Owner)) {
            regionalIds.add(hop2Owner);
          }
        }
      }
    }
  }

  const actorTotalTroops = computeRealmTotalTroops(
    actorId,
    activeTerrs,
    movements
  );
  const threatNeighborIds = Array.from(neighborIds).filter((nId) => {
    const nbNat = nations[nId];
    if (!nbNat || nbNat.isEliminated) return false;
    const nbTroops = computeRealmTotalTroops(nId, activeTerrs, movements);
    const nbRel = getOrCreateRelation(relations, actorId, nId);
    return (
      !nbRel.isAllied &&
      (nbNat.aggressiveExpansion >= 30 ||
        nbTroops >= actorTotalTroops * 1.25 ||
        nbRel.score <= -25)
    );
  });
  const hasStrongerOrHighAeNeighbor = threatNeighborIds.length > 0;

  const countExistingAlliances = (nId: string) =>
    Object.values(relations).filter(
      (r) =>
        (r.nationA === nId || r.nationB === nId) &&
        (r.isAllied || Boolean(r.allianceType))
    ).length;

  const actorAllianceCount = countExistingAlliances(actorId);

  // 4B-1: Direct Neighbors + Regional Peers (Smart Compatibility, Warming, Pacts & Coalitions)
  const rawAiPeers = Array.from(
    new Set([...Array.from(neighborIds), ...Array.from(regionalIds)])
  ).filter(
    (id) => id !== playerNationId && nations[id] && !nations[id].isEliminated
  );
  const aiPeers =
    worldSeed !== undefined
      ? seededShuffle(rawAiPeers, worldSeed, `peers_${nextTick}_${actorId}`)
      : rawAiPeers;

  const peersHoldingActorCore = new Set<string>();
  for (const t of Object.values(activeTerrs)) {
    if (t && t.coreOwnerId === actorId && t.ownerId !== actorId) {
      peersHoldingActorCore.add(t.ownerId);
    }
  }

  for (const peerId of aiPeers) {
    const peer = nations[peerId];
    if (!peer || isAtWar(wars, actorId, peerId)) continue;

    const rel = getOrCreateRelation(relations, actorId, peerId);
    const rKey = relationKey(actorId, peerId);
    const compat = computeAllianceCompatibilityScore({
      actor: actorNation,
      peer,
      rel,
      wars,
      relations,
      nations,
      gameMode,
      threatNeighborIds,
      actorPersonality,
      isDirectNeighbor: neighborIds.has(peerId),
      peerOwnsActorCore: peersHoldingActorCore.has(peerId),
    });

    // 1) Form Defensive Pact when compatible and threatened / sharing common threat (cap 2 alliances per AI)
    const allianceReady =
      !compat.blocked &&
      !rel.isAllied &&
      !rel.allianceType &&
      actorAllianceCount < 2 &&
      countExistingAlliances(peerId) < 2 &&
      ((hasStrongerOrHighAeNeighbor ||
        compat.sharesCommonThreat ||
        compat.sharesCommonWarEnemy) &&
        (compat.score >= 28 ||
          (compat.sharesCommonThreat && rel.score >= 5) ||
          rel.score >= 18));

    if (allianceReady) {
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          score: Math.min(100, rel.score + 15),
          isAllied: true,
          allianceType: 'DEFENSIVE',
          hasNonAggression: true,
          hasMilitaryAccess: true,
        },
      };
      diploNewsItem = {
        title: `🛡️ Bölgesel Savunma Paktı: ${actorNation.name} & ${peer.name}`,
        description: compat.sharesCommonWarEnemy
          ? `${actorNation.name} ve ${peer.name}, ortak savaş düşmanlarına karşı savunma paktı kurdu.`
          : compat.sharesCommonThreat
          ? `${actorNation.name} ve ${peer.name}, ortak bölgesel tehditlere karşı savunma paktı kurdu.`
          : `${actorNation.name} ve ${peer.name}, bölgesel güç dengesini korumak amacıyla ortak savunma paktı imzaladı.`,
        type: 'COALITION',
      };
      break;
    }

    // 1B) Upgrade strong Defensive Pact to Offensive Coalition when interests align
    if (
      !compat.blocked &&
      rel.allianceType === 'DEFENSIVE' &&
      rel.score >= 42 &&
      (compat.sharesCommonThreat ||
        compat.sharesCommonWarEnemy ||
        actorPersonality === 'CONQUEROR' ||
        actorPersonality === 'REVANCHIST') &&
      (worldSeed === undefined ||
        seededHash(worldSeed, `off_upg_${nextTick}_${actorId}_${peerId}`) <
          0.45)
    ) {
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          score: Math.min(100, rel.score + 8),
          isAllied: true,
          allianceType: 'OFFENSIVE',
          hasMilitaryAccess: true,
        },
      };
      diploNewsItem = {
        title: `⚔️ Saldırı Koalisyonu: ${actorNation.name} & ${peer.name}`,
        description: `${actorNation.name} ile ${peer.name}, mevcut savunma paktını ortak taarruz ittifakına yükseltti.`,
        type: 'COALITION',
      };
      break;
    }

    // 2) Sign Trade Agreement between peaceful non-hostile peers (especially MERCHANT)
    if (
      !compat.blocked &&
      !rel.hasTradeAgreement &&
      !rel.hasEmbargo &&
      rel.score >= (actorPersonality === 'MERCHANT' ? -5 : 2)
    ) {
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          score: Math.min(100, rel.score + 8),
          hasTradeAgreement: true,
        },
      };
      break;
    }

    // 3) Sign Non-Aggression Pact between peaceful neighbors of comparable strength
    if (
      !compat.blocked &&
      neighborIds.has(peerId) &&
      !rel.hasNonAggression &&
      !rel.isAllied &&
      rel.score >= 10
    ) {
      const peerTroops = computeRealmTotalTroops(peerId, activeTerrs, movements);
      if (
        peerTroops >= actorTotalTroops * 0.7 &&
        peerTroops <= actorTotalTroops * 1.45
      ) {
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.min(100, rel.score + 6),
            hasNonAggression: true,
          },
        };
        break;
      }
    }

    // 4) Organic Diplomatic Warming: compatible peers gradually warm relations so natural alliances emerge
    if (
      !compat.blocked &&
      !rel.isAllied &&
      rel.score < 32 &&
      (compat.score >= 12 ||
        compat.sharesCommonThreat ||
        compat.sharesCommonWarEnemy) &&
      (worldSeed === undefined ||
        seededHash(worldSeed, `warm_${nextTick}_${actorId}_${peerId}`) < 0.42)
    ) {
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          score: Math.min(100, rel.score + 12),
        },
      };
      break;
    }
  }

  // 4B-1C: Organic Border Friction (living world rivalries emerge dynamically across campaigns)
  if (
    !updatedRelations &&
    worldSeed !== undefined &&
    nextTick >= 12 &&
    (actorPersonality === 'CONQUEROR' ||
      actorPersonality === 'REVANCHIST' ||
      seededHash(worldSeed, `fric_roll_${nextTick}_${actorId}`) < 0.22)
  ) {
    const frictionCandidates = seededShuffle(
      Array.from(neighborIds).filter((nId) => {
        const nb = nations[nId];
        if (
          !nb ||
          nb.isEliminated ||
          nb.vassalOf === actorId ||
          actorNation.vassalOf === nId
        ) {
          return false;
        }
        const rel = getOrCreateRelation(relations, actorId, nId);
        return (
          !rel.isAllied &&
          !rel.allianceType &&
          !rel.hasNonAggression &&
          rel.truceUntilTick <= nextTick &&
          rel.score > -45 &&
          rel.score < 20
        );
      }),
      worldSeed,
      `fric_${nextTick}_${actorId}`
    );
    const frictionTargetId = frictionCandidates[0];
    if (
      frictionTargetId &&
      seededHash(worldSeed, `fric_exec_${nextTick}_${actorId}_${frictionTargetId}`) <
        0.35
    ) {
      const rel = getOrCreateRelation(relations, actorId, frictionTargetId);
      const rKey = relationKey(actorId, frictionTargetId);
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          score: Math.max(-100, rel.score - 12),
        },
      };
    }
  }

  // 4B-2: AI-to-AI / AI-to-Player Embargo against High-AE / Deeply Hostile Rivals
  const embargoEligibleTick =
    worldSeed !== undefined
      ? nextTick >= 18 &&
        seededHash(worldSeed, `emb_gate_${nextTick}_${actorId}`) < 0.35
      : stepIndex % 4 === 0;

  if (!updatedRelations && embargoEligibleTick) {
    const candidateThreats =
      worldSeed !== undefined
        ? seededShuffle(
            threatNeighborIds,
            worldSeed,
            `emb_tgt_${nextTick}_${actorId}`
          )
        : threatNeighborIds;

    const embargoTargetId = candidateThreats.find((nId) => {
      const nbNat = nations[nId];
      if (
        !nbNat ||
        nbNat.isEliminated ||
        nbNat.vassalOf === actorId ||
        actorNation.vassalOf === nId
      ) {
        return false;
      }
      const rel = getOrCreateRelation(relations, actorId, nId);
      const alreadyEmbargoedByActor =
        getEmbargoingNationIds(rel).includes(actorId);
      return (
        !alreadyEmbargoedByActor &&
        !rel.isAllied &&
        !rel.allianceType &&
        (nbNat.aggressiveExpansion >= 45 || rel.score <= -40)
      );
    });

    if (embargoTargetId) {
      const targetNat = nations[embargoTargetId];
      const rel = getOrCreateRelation(relations, actorId, embargoTargetId);
      const rKey = relationKey(actorId, embargoTargetId);
      const nextEmbargoers = Array.from(
        new Set([...getEmbargoingNationIds(rel), actorId])
      );
      updatedRelations = {
        ...relations,
        [rKey]: {
          ...rel,
          hasEmbargo: true,
          embargoingNationIds: nextEmbargoers,
          hasTradeAgreement: false,
          score: Math.max(-100, rel.score - 12),
        },
      };
      if (embargoTargetId === playerNationId) {
        diploNewsItem = {
          title: `🚫 Ticaret Ambargosu: ${actorNation.name}`,
          description: `${actorNation.name}, yükselen gerilim ve agresif genişleme nedeniyle devletimize ticaret ambargosu başlattı.`,
          type: 'COALITION',
        };
      } else if (targetNat) {
        diploNewsItem = {
          title: `🚫 Ambargo: ${actorNation.name} → ${targetNat.name}`,
          description: `${actorNation.name}, ${targetNat.name} devletine ekonomik yaptırım ve ticaret ambargosu uyguladı.`,
          type: 'ECONOMY',
        };
      }
    }
  }

  // 4B-3: Proactive AI-to-Player Live Diplomatic Offers
  if (
    !hasActiveIncomingOffer &&
    nextTick >= 9 &&
    nextTick % 12 === 0 &&
    (neighborIds.has(playerNationId) || regionalIds.has(playerNationId)) &&
    !isAtWar(wars, actorId, playerNationId)
  ) {
    const relWithPlayer = getOrCreateRelation(
      updatedRelations || relations,
      actorId,
      playerNationId
    );
    const playerTotalTroops = computeRealmTotalTroops(
      playerNationId,
      activeTerrs,
      movements
    );

    if (
      !relWithPlayer.isAllied &&
      !relWithPlayer.allianceType &&
      relWithPlayer.score >= 22 &&
      hasStrongerOrHighAeNeighbor &&
      actorAllianceCount < 2
    ) {
      incomingOffer = {
        id: `offer_${nextTick}_${actorId}`,
        fromNationId: actorId,
        kind: 'DEFENSIVE_PACT',
        createdTick: nextTick,
        expiresTick: nextTick + 21,
        message: `${actorNation.name} elçisi, bölgesel tehditlere karşı Karşılıklı Savunma Paktı teklif ediyor.`,
      };
    } else if (
      !relWithPlayer.hasTradeAgreement &&
      !relWithPlayer.hasEmbargo &&
      relWithPlayer.score >= (actorPersonality === 'MERCHANT' ? 0 : 8)
    ) {
      incomingOffer = {
        id: `offer_${nextTick}_${actorId}`,
        fromNationId: actorId,
        kind: 'TRADE',
        createdTick: nextTick,
        expiresTick: nextTick + 21,
        message: `${actorNation.name} (${personalityMeta.shortLabel}), karşılıklı ticaret gelirini artıracak Serbest Ticaret Anlaşması öneriyor.`,
      };
    } else if (
      neighborIds.has(playerNationId) &&
      !relWithPlayer.hasNonAggression &&
      !relWithPlayer.isAllied &&
      relWithPlayer.score >= 6
    ) {
      incomingOffer = {
        id: `offer_${nextTick}_${actorId}`,
        fromNationId: actorId,
        kind: 'NON_AGGRESSION',
        createdTick: nextTick,
        expiresTick: nextTick + 21,
        message: `${actorNation.name}, ortak sınır güvenliği için Saldırmazlık Paktı imzalamak istiyor.`,
      };
    } else if (
      neighborIds.has(playerNationId) &&
      playerTotalTroops >= actorTotalTroops * 2.1 &&
      relWithPlayer.score >= -30 &&
      actorNation.treasury >= 450
    ) {
      const giftGold = Math.min(
        360,
        Math.max(160, Math.round(actorNation.treasury * 0.22))
      );
      incomingOffer = {
        id: `offer_${nextTick}_${actorId}`,
        fromNationId: actorId,
        kind: 'TRIBUTE_GIFT',
        goldGift: giftGold,
        createdTick: nextTick,
        expiresTick: nextTick + 21,
        message: `${actorNation.name}, askeri gücünüze hürmeten barışı korumak için ${giftGold} Altın iyi niyet hediyesi sunuyor.`,
      };
    }
  }

  return { updatedRelations, diploNewsItem, incomingOffer };
}

/**
 * Step 5: Strategic coalition-aware war evaluation and declaration.
 */
export function evaluateAiOffensiveWarDeclaration(params: {
  actorId: string;
  actorNation: Nation;
  playerNationId: string;
  ownedProvinces: Territory[];
  activeTerrs: Record<string, Territory>;
  nations: Record<string, Nation>;
  updatedNations?: Record<string, Nation>;
  updatedTerritories?: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  updatedRelations?: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  nextTick: number;
  aiAggressiveness: AiAggressivenessLevel;
  actorPersonality: AiPersonality;
  actorInAnyWar: boolean;
  worldSeed?: number;
}): AiTurnResult | null {
  const {
    actorId,
    actorNation,
    playerNationId,
    ownedProvinces,
    activeTerrs,
    nations,
    updatedNations,
    updatedTerritories,
    relations,
    updatedRelations,
    wars,
    movements,
    nextTick,
    aiAggressiveness,
    actorPersonality,
    actorInAnyWar,
    worldSeed,
  } = params;

  const personalityMeta = AI_PERSONALITY_META[actorPersonality];
  const isMasterAiDifficulty =
    aiAggressiveness === 'AGGRESSIVE' || aiAggressiveness === 'CHAOS';

  const maxAllowedGlobalWars =
    aiAggressiveness === 'PASSIVE'
      ? 1
      : aiAggressiveness === 'NORMAL'
      ? 3
      : aiAggressiveness === 'AGGRESSIVE'
      ? 3
      : 4;

  const localRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.9
      : aiAggressiveness === 'NORMAL'
      ? 1.35
      : aiAggressiveness === 'AGGRESSIVE'
      ? 1.25
      : 1.18;

  const coalitionRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.55
      : aiAggressiveness === 'NORMAL'
      ? 1.15
      : aiAggressiveness === 'AGGRESSIVE'
      ? 1.18
      : 1.12;

  const minWarStability = isMasterAiDifficulty ? 56 : 45;
  const minWarManpower = isMasterAiDifficulty ? 9000 : 5000;
  const minWarTreasury = isMasterAiDifficulty ? 750 : 350;

  const actorReadyForOffensiveWar =
    !actorInAnyWar &&
    actorNation.stability >= minWarStability &&
    actorNation.manpower >= minWarManpower &&
    actorNation.treasury >= minWarTreasury &&
    wars.length < maxAllowedGlobalWars;

  if (!actorReadyForOffensiveWar) return null;

  const candidateProvs =
    worldSeed !== undefined
      ? seededShuffle(
          ownedProvinces,
          worldSeed,
          `war_prov_${nextTick}_${actorId}`
        )
      : ownedProvinces;

  for (const prov of candidateProvs) {
    const currProv = activeTerrs[prov.id];
    if (!currProv || currProv.garrison < 12000) continue;

    const candidateNeighbors =
      worldSeed !== undefined
        ? seededShuffle(
            currProv.neighbors,
            worldSeed,
            `war_nb_${nextTick}_${currProv.id}`
          )
        : currProv.neighbors;

    const candidateTargetId = candidateNeighbors.find((nId) => {
      const nTerr = activeTerrs[nId];
      if (!nTerr || nTerr.ownerId === actorId) return false;
      const targetOwner = nations[nTerr.ownerId];
      if (
        !targetOwner ||
        targetOwner.isEliminated ||
        targetOwner.vassalOf === actorId ||
        actorNation.vassalOf === targetOwner.id
      ) {
        return false;
      }
      if (isAtWar(wars, actorId, targetOwner.id)) return false;

      const rel = getOrCreateRelation(
        updatedRelations || relations,
        actorId,
        targetOwner.id
      );
      if (
        rel.isAllied ||
        rel.hasNonAggression ||
        rel.truceUntilTick > nextTick ||
        rel.score > 25
      ) {
        return false;
      }

      const simParticipants = resolveWarParticipants(
        actorId,
        targetOwner.id,
        updatedRelations || relations,
        nations
      );
      const attackerCoalitionTroops = simParticipants.attackers.reduce(
        (sum, id) => sum + computeRealmTotalTroops(id, activeTerrs, movements),
        0
      );
      const defenderCoalitionTroops = simParticipants.defenders.reduce(
        (sum, id) => sum + computeRealmTotalTroops(id, activeTerrs, movements),
        0
      );

      const targetDistractedWars = wars.filter(
        (w) =>
          w.attackers.includes(targetOwner.id) ||
          w.defenders.includes(targetOwner.id)
      ).length;
      const distractionDiscount = Math.max(
        0.65,
        1 - targetDistractedWars * 0.16
      );

      const isRevanchistCoreClaim =
        actorPersonality === 'REVANCHIST' && nTerr.coreOwnerId === actorId;
      const baseWarMod = isRevanchistCoreClaim
        ? 0.75
        : personalityMeta.warReadinessMod;
      const seedJitter =
        worldSeed !== undefined
          ? 0.9 +
            seededHash(
              worldSeed,
              `war_mod_${nextTick}_${actorId}_${targetOwner.id}`
            ) *
              0.22
          : 1;
      const pWarMod = baseWarMod * seedJitter;

      const isHighAeCoalition =
        targetOwner.aggressiveExpansion >= 55 &&
        attackerCoalitionTroops >= defenderCoalitionTroops * 0.75;
      const hasEmpireAdvantage =
        attackerCoalitionTroops >=
        defenderCoalitionTroops *
          coalitionRatioThreshold *
          distractionDiscount *
          pWarMod;
      const hasBorderAdvantage =
        currProv.garrison >= nTerr.garrison * localRatioThreshold * pWarMod;

      return isHighAeCoalition || (hasEmpireAdvantage && hasBorderAdvantage);
    });

    if (candidateTargetId) {
      const targetTerr = activeTerrs[candidateTargetId];
      const targetOwner = nations[targetTerr.ownerId];
      if (targetOwner) {
        const isCoalition = targetOwner.aggressiveExpansion >= 55;
        const resolution = resolveWarParticipants(
          actorId,
          targetOwner.id,
          updatedRelations || relations,
          nations
        );

        const defAllyNames = resolution.defensiveAlliesCalled
          .map((id) => nations[id]?.name)
          .filter(Boolean);
        const attAllyNames = resolution.offensiveAlliesCalled
          .map((id) => nations[id]?.name)
          .filter(Boolean);

        let allyDesc = '';
        if (defAllyNames.length > 0) {
          allyDesc += ` Savunma paktı uyarınca (${defAllyNames.join(', ')}) savunmaya katıldı.`;
        }
        if (attAllyNames.length > 0) {
          allyDesc += ` Saldırı paktı müttefikleri (${attAllyNames.join(', ')}) taarruza katıldı.`;
        }

        const newWar: ActiveWar = {
          id: `ai_war_${nextTick}_${actorId}`,
          name: isCoalition
            ? `${actorNation.name} Koalisyon Müdahalesi (${targetOwner.name})`
            : `${actorNation.name} - ${targetOwner.name} Savaşı`,
          attackerId: actorId,
          defenderId: targetOwner.id,
          attackers: resolution.attackers,
          defenders: resolution.defenders,
          startedTick: nextTick,
          attackerWarScore: 0,
          casualtiesAttacker: 0,
          casualtiesDefender: 0,
        };

        let alertMessage: string | undefined;
        if (targetOwner.id === playerNationId) {
          alertMessage = `DİKKAT: ${actorNation.name} devletimize savaş ilan etti!`;
        } else if (resolution.defenders.includes(playerNationId)) {
          alertMessage = `🛡️ SAVUNMA PAKTI TETİKLENDİ: Müttefikiniz ${targetOwner.name} saldırıya uğradı! Pakt gereği ${actorNation.name} ile savunma savaşına dahil edildiniz.`;
        } else if (resolution.attackers.includes(playerNationId)) {
          alertMessage = `⚔️ SALDIRI PAKTI DEVREDE: Saldırı paktı ortağınız ${actorNation.name}, ${targetOwner.name} hedefine taarruz başlattı.`;
        }

        return {
          updatedNations,
          updatedTerritories,
          updatedRelations,
          newWar,
          newsItem: {
            title: newWar.name,
            description:
              (isCoalition
                ? `${actorNation.name}, aşırı genişleyen ${targetOwner.name} devletine karşı Koalisyon Savaşı başlattı!`
                : `${actorNation.name}, sınır komşusu ${targetOwner.name} devletine (${targetTerr.name} cephesinden) savaş ilan etti.`) +
              allyDesc,
            type: isCoalition ? 'COALITION' : 'WAR',
          },
          playerAlert: alertMessage,
        };
      }
    }
  }

  return null;
}
