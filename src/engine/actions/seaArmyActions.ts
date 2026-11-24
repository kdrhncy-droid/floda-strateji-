import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  SeaArmy,
  SpeedLevel,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  formatGameDate,
  resolveSeaRegionName,
  resolveWarParticipants,
} from '../simulationEngine';
import {
  getOrCreateRelation,
  isAtWar,
} from '../core/diplomacyHelpers';
import { isTerritoryCoastal } from '../worldBuilder';
import { scaleUnits } from '../core/unitHelpers';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

/**
 * Embarks an army from a coastal province onto open sea coordinates (or repositions an existing SeaArmy at sea).
 */
export function executeEmbarkToSeaDomain(params: {
  sourceTerritoryId?: string | null;
  sourceSeaArmyId?: string | null;
  targetCoords: [number, number];
  targetSeaArmyId?: string | null;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  playerNationId: string;
  moveRatio: number;
  speed: SpeedLevel;
}): EmpireActionPatch {
  const {
    sourceTerritoryId,
    sourceSeaArmyId,
    targetCoords,
    targetSeaArmyId,
    territories,
    nations,
    movements,
    seaArmies,
    playerNationId,
    moveRatio,
    speed,
  } = params;

  const playerNation = nations[playerNationId];
  if (!playerNation) return {};

  const normalizedRatio = Number.isFinite(moveRatio)
    ? Math.max(0.1, Math.min(1, moveRatio))
    : 1;
  const seaName = resolveSeaRegionName(targetCoords);

  // Case 1: Repositioning or splitting an existing SeaArmy across the sea
  if (sourceSeaArmyId) {
    const fleet = seaArmies.find(
      (s) => s.id === sourceSeaArmyId && s.ownerId === playerNationId
    );
    if (!fleet) return {};
    if (targetSeaArmyId && targetSeaArmyId === fleet.id) {
      return { seaArmyOrderSourceId: null };
    }

    const sendTroops =
      normalizedRatio >= 0.99
        ? fleet.troops
        : Math.max(500, Math.round(fleet.troops * normalizedRatio));
    if (sendTroops < 500 || sendTroops > fleet.troops) {
      return {
        toastMessage: 'Denizde hareket için en az 500 askerlik filo gerekli.',
      };
    }

    const sendRatio = sendTroops / Math.max(1, fleet.troops);
    const sentUnits = scaleUnits(fleet.units, sendRatio);
    const remainingTroops = fleet.troops - sendTroops;
    const nextSeaArmies =
      remainingTroops < 300
        ? seaArmies.filter((s) => s.id !== fleet.id)
        : seaArmies.map((s) =>
            s.id === fleet.id
              ? {
                  ...s,
                  troops: remainingTroops,
                  units: {
                    infantry: Math.max(0, s.units.infantry - sentUnits.infantry),
                    armor: Math.max(0, s.units.armor - sentUnits.armor),
                    airDrone: Math.max(0, s.units.airDrone - sentUnits.airDrone),
                  },
                }
              : s
          );

    const anchorId =
      fleet.anchorCoastId && territories[fleet.anchorCoastId]
        ? fleet.anchorCoastId
        : playerNation.capitalTerritoryId;

    sound.playMarch();
    return {
      seaArmies: nextSeaArmies,
      movements: [
        ...movements,
        {
          id: `mv_sea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId: playerNationId,
          fromTerritoryId: anchorId,
          toTerritoryId: anchorId,
          fromCoords: fleet.coords,
          toCoords: targetCoords,
          targetSeaName: seaName,
          targetSeaArmyId: targetSeaArmyId || undefined,
          sourceSeaArmyId: fleet.id,
          isNaval: true,
          troops: remainingTroops < 300 ? fleet.troops : sendTroops,
          units: remainingTroops < 300 ? fleet.units : sentUnits,
          progress: 12,
          isAttack: false,
        },
      ],
      selectedSeaArmyId: remainingTroops < 300 ? null : fleet.id,
      seaArmyOrderSourceId: null,
      armyOrderSourceId: null,
      ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      toastMessage: `${fleet.name} yeni deniz mevkiine (${seaName}) yelken açtı.`,
    };
  }

  // Case 2: Embarking from a coastal province onto open water
  if (!sourceTerritoryId) return {};
  const fromT = territories[sourceTerritoryId];
  if (!fromT || fromT.ownerId !== playerNationId) {
    return {
      toastMessage: 'Sadece kendi kontrolünüzdeki kıyı şehirlerinden denize açılabilirsiniz.',
    };
  }
  if (!isTerritoryCoastal(fromT)) {
    return {
      toastMessage: `${fromT.name} kara içi bir şehirdir; denize açılmak için kıyı (sahil) şehri seçin.`,
    };
  }

  const sendableTroops = Math.max(0, Math.floor(fromT.garrison - 500));
  const sendTroops = Math.min(
    sendableTroops,
    Math.round(sendableTroops * normalizedRatio)
  );
  if (sendTroops < 1000) {
    return {
      toastMessage:
        'Denize açılmak için en az 1.000 asker sevk edilmeli; kıyı şehrinde 500 savunma askeri kalır.',
    };
  }

  const sourceUnits = fromT.units || {
    infantry: fromT.garrison,
    armor: 0,
    airDrone: 0,
  };
  const sentUnits = scaleUnits(
    sourceUnits,
    sendTroops / Math.max(1, fromT.garrison)
  );
  const remainingUnits = {
    infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
    armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
    airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
  };

  sound.playMarch();
  return {
    territories: {
      ...territories,
      [sourceTerritoryId]: {
        ...fromT,
        garrison: Math.max(0, fromT.garrison - sendTroops),
        units: remainingUnits,
      },
    },
    movements: [
      ...movements,
      {
        id: `mv_embark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: playerNationId,
        fromTerritoryId: sourceTerritoryId,
        toTerritoryId: sourceTerritoryId,
        fromCoords: fromT.centroid,
        toCoords: targetCoords,
        targetSeaName: seaName,
        targetSeaArmyId: targetSeaArmyId || undefined,
        isNaval: true,
        troops: sendTroops,
        units: sentUnits,
        progress: 12,
        isAttack: false,
      },
    ],
    armyOrderSourceId: null,
    seaArmyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: `${fromT.name} limanından ${(sendTroops / 1000).toFixed(1)}B asker ${seaName} mevkiine denize açıldı.`,
  };
}

/**
 * Disembarks an army stationed at sea (SeaArmy) onto a coastal land territory (friendly landing or amphibious assault).
 */
export function executeDisembarkFromSeaDomain(params: {
  sourceSeaArmyId: string;
  toTerritoryId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    sourceSeaArmyId,
    toTerritoryId,
    territories,
    nations,
    relations,
    wars,
    movements,
    seaArmies,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const fleet = seaArmies.find(
    (s) => s.id === sourceSeaArmyId && s.ownerId === playerNationId
  );
  const toT = territories[toTerritoryId];
  const playerNation = nations[playerNationId];
  if (!fleet || !toT || !playerNation) return {};

  if (!isTerritoryCoastal(toT)) {
    return {
      toastMessage: `${toT.name} kara içi bir şehirdir; deniz filosundan yalnızca kıyı şehirlerine çıkarma yapılabilir.`,
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    const anchorId =
      fleet.anchorCoastId && territories[fleet.anchorCoastId]
        ? fleet.anchorCoastId
        : playerNation.capitalTerritoryId;
    return {
      pendingWarMove: {
        fromId: anchorId,
        sourceSeaArmyId: fleet.id,
        moveRatio,
        toId: toTerritoryId,
        targetNationId: toT.ownerId,
      },
      seaArmyOrderSourceId: null,
      toastMessage: `${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! Amfibi çıkarma için Savaş İlanını onaylayın.`,
    };
  }

  const normalizedRatio = Number.isFinite(moveRatio)
    ? Math.max(0.1, Math.min(1, moveRatio))
    : 1;
  const sendTroops =
    normalizedRatio >= 0.99
      ? fleet.troops
      : Math.max(500, Math.round(fleet.troops * normalizedRatio));
  const sentUnits =
    normalizedRatio >= 0.99
      ? fleet.units
      : scaleUnits(fleet.units, sendTroops / Math.max(1, fleet.troops));
  const remainingTroops = fleet.troops - sendTroops;
  const nextSeaArmies =
    remainingTroops < 300
      ? seaArmies.filter((s) => s.id !== fleet.id)
      : seaArmies.map((s) =>
          s.id === fleet.id
            ? {
                ...s,
                troops: remainingTroops,
                units: {
                  infantry: Math.max(0, s.units.infantry - sentUnits.infantry),
                  armor: Math.max(0, s.units.armor - sentUnits.armor),
                  airDrone: Math.max(0, s.units.airDrone - sentUnits.airDrone),
                },
              }
            : s
        );

  let nextWars = wars;
  let nextNews = newsEvents;
  let toast = `${fleet.name}, ${toT.name} kıyısına çıkarma harekatı başlattı.`;

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );
    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];
    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: `${playerNation.name} donanması ${toT.name} kıyısına amfibi çıkarma başlattı.`,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    toast = `${targetNation?.name} devletine savaş ilan edildi ve ${toT.name} kıyısına çıkarma başlatıldı!`;
  } else {
    sound.playMarch();
  }

  const anchorId =
    fleet.anchorCoastId && territories[fleet.anchorCoastId]
      ? fleet.anchorCoastId
      : playerNation.capitalTerritoryId;

  return {
    wars: nextWars,
    newsEvents: nextNews,
    seaArmies: nextSeaArmies,
    movements: [
      ...movements,
      {
        id: `mv_land_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: playerNationId,
        fromTerritoryId: anchorId,
        toTerritoryId,
        fromCoords: fleet.coords,
        sourceSeaArmyId: fleet.id,
        isNaval: true,
        troops: remainingTroops < 300 ? fleet.troops : sendTroops,
        units: remainingTroops < 300 ? fleet.units : sentUnits,
        progress: 14,
        isAttack: Boolean(
          isForeign && isAtWar(nextWars, playerNationId, toT.ownerId)
        ),
      },
    ],
    selectedSeaArmyId: remainingTroops < 300 ? null : fleet.id,
    seaArmyOrderSourceId: null,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: toast,
  };
}

export function disbandSeaArmyDomain(params: {
  seaArmyId: string;
  ratio: 0.5 | 1;
  seaArmies: SeaArmy[];
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { seaArmyId, ratio, seaArmies, nations, playerNationId } = params;
  const fleet = seaArmies.find(
    (s) => s.id === seaArmyId && s.ownerId === playerNationId
  );
  const p = nations[playerNationId];
  if (!fleet || !p) return {};

  const disbandTroops =
    ratio === 1 ? fleet.troops : Math.round(fleet.troops * 0.5);
  const refundedMp = Math.round(disbandTroops * 0.75);
  const remaining = fleet.troops - disbandTroops;

  const nextSeaArmies =
    remaining < 200
      ? seaArmies.filter((s) => s.id !== fleet.id)
      : seaArmies.map((s) =>
          s.id === fleet.id
            ? {
                ...s,
                troops: remaining,
                units: scaleUnits(s.units, remaining / Math.max(1, s.troops)),
              }
            : s
        );

  sound.playClick();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        manpower: p.manpower + refundedMp,
      },
    },
    seaArmies: nextSeaArmies,
    selectedSeaArmyId: remaining < 200 ? null : fleet.id,
    seaArmyOrderSourceId: remaining < 200 ? null : undefined,
    toastMessage: `${fleet.name}: ${disbandTroops.toLocaleString('tr-TR')} asker terhis edildi (+${refundedMp.toLocaleString('tr-TR')} İnsan Gücü iade edildi).`,
  };
}

