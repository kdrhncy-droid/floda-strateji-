import { DiplomaticRelation, IdeologyId, Nation, Territory } from '../types/game';
import { STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import { GeoCountryFeature, InitialWorldBundle } from './core/worldTypes';
import { relationKey } from './core/diplomacyHelpers';
import { getHistoricProvinceNames } from './polygonSubdivider';
import { deconflictNeighborColors } from './core/nationColorUtils';
import scenario1440Data from '../data/json/scenario1440.json';
import { resolveNationRuntimeId } from '../data/nationTagRegistry';

export interface Empire1440Def {
  id: string;
  tag: string;
  name: string;
  flagCode: string;
  color: string;
  ideology: IdeologyId;
  capitalName: string;
  capitalTerritoryId?: string;
  treasury: number;
  manpower: number;
  absorbedCountryIds: string[];
  provinceRenames?: Record<string, string>;
}

export const EMPIRES_1440_DEFS: Empire1440Def[] =
  scenario1440Data.empires as unknown as Empire1440Def[];

const PROVINCE_OWNER_OVERRIDES_1440: Record<string, string> = Object.fromEntries(
  Object.entries(scenario1440Data.provinceOwnerOverridesByTag as Record<string, string>).map(
    ([provId, ownerTagOrId]) => [provId, resolveNationRuntimeId(ownerTagOrId, '1440')]
  )
);

const TARGET_1440_EMPIRE_SCALE: Record<
  string,
  { targetArmy: number; targetGdp: number }
> = Object.fromEntries(
  Object.entries(
    scenario1440Data.targetScaleByTag as Record<
      string,
      { targetArmy: number; targetGdp: number }
    >
  ).map(([tagOrId, val]) => [resolveNationRuntimeId(tagOrId, '1440'), val])
);

const HISTORICAL_STRAIT_LINKS_1440 =
  scenario1440Data.historicalStraitLinks as [string, string][];

const STARTING_RELATIONS_1440 =
  scenario1440Data.startingRelationsByTag as [string, string, Partial<DiplomaticRelation>][];

export function transformBundleTo1440Scenario(
  baseBundle: InitialWorldBundle
): InitialWorldBundle {
  // Map every absorbed country ID to its 1440 Empire owner ID
  const countryToEmpireId: Record<string, string> = {};
  const empireDefMap: Record<string, Empire1440Def> = {};

  EMPIRES_1440_DEFS.forEach((emp) => {
    empireDefMap[emp.id] = emp;
    emp.absorbedCountryIds.forEach((cId) => {
      countryToEmpireId[cId] = emp.id;
    });
  });

  const allRenames1440: Record<string, string> = {};
  EMPIRES_1440_DEFS.forEach((emp) => Object.assign(allRenames1440, emp.provinceRenames));
  // Data-driven period names (Saruhan, Ruha, Ayıntab, Pskov, Echigo, Flandre...).
  // Explicit scenario renames above still take priority (e.g. "★ Edirne").
  const historicNames1440 = getHistoricProvinceNames();
  const nations: Record<string, Nation> = {};
  const territories: Record<string, Territory> = {};
  const features: GeoCountryFeature[] = [];

  // 1. Create Historical Empires & Kingdoms
  EMPIRES_1440_DEFS.forEach((emp) => {
    const baseN = baseBundle.nations[emp.id];
    const isOttoman = emp.id === '792';
    const resolvedCapId =
      emp.capitalTerritoryId && baseBundle.territories[emp.capitalTerritoryId]
        ? emp.capitalTerritoryId
        : emp.id;
    nations[emp.id] = {
      ...(baseN || {
        id: emp.id,
        capitalTerritoryId: resolvedCapId,
        stability: 82,
        inflation: 2.5,
        researchPoints: 135,
        taxRate: 25,
        budget: { military: 35, economy: 30, research: 15, welfare: 20 },
        aggressiveExpansion: 15,
        unlockedTechs: ['eco_1'],
        modernizedArmyTier: 0,
        enactedReforms: [],
        recruitedGeneralIds: [],
        activeGeneralId: null,
        clanInfluence: 160,
        bannerCalledLordIds: [],
        formedEmpireId: null,
        vassalOf: null,
        isEliminated: false,
      }),
      id: emp.id,
      tag: emp.tag,
      name: emp.name,
      flagCode: emp.flagCode,
      color: emp.color,
      ideology: emp.ideology,
      capitalTerritoryId: resolvedCapId,
      treasury: Math.round(emp.treasury * 0.45),
      manpower: emp.manpower,
      researchPoints: isOttoman ? 65 : 50,
      researchProgressByTech: {},
      unlockedTechs: ['eco_1'],
      modernizedArmyTier: 0,
      recruitedGeneralIds: isOttoman ? ['cmd_candarli'] : [],
      activeGeneralId: isOttoman ? 'cmd_candarli' : null,
      clanInfluence: 110,
      bannerCalledLordIds: [],
    };
  });

  // Precompute empire capital coordinates so any unmapped country joins its closest regional 1440 empire (zero missing land holes!)
  const empireAnchorCoords: { id: string; lon: number; lat: number }[] =
    EMPIRES_1440_DEFS.map((emp) => {
      const capId =
        emp.capitalTerritoryId && baseBundle.territories[emp.capitalTerritoryId]
          ? emp.capitalTerritoryId
          : emp.id;
      const capT = baseBundle.territories[capId] ?? baseBundle.territories[emp.id];
      return {
        id: emp.id,
        lon: capT?.centroid[0] ?? 30,
        lat: capT?.centroid[1] ?? 40,
      };
    });

  // 2. Reassign all world provinces to the Historical Empires so 100% of world landmasses are rendered!
  baseBundle.features.forEach((feat) => {
    const baseCountryId = feat.id.split('_')[0];
    const baseT = baseBundle.territories[feat.id];
    if (!baseT) return;

    let targetEmpireId =
      PROVINCE_OWNER_OVERRIDES_1440[feat.id] ??
      countryToEmpireId[baseCountryId];
    if (!targetEmpireId) {
      let bestId = '792';
      let bestDist = Infinity;
      for (const anc of empireAnchorCoords) {
        const d =
          (baseT.centroid[0] - anc.lon) ** 2 +
          (baseT.centroid[1] - anc.lat) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestId = anc.id;
        }
      }
      targetEmpireId = bestId;
    }

    const empDef = empireDefMap[targetEmpireId];
    const renames = { ...allRenames1440, ...(empDef?.provinceRenames || {}) };
    const customName =
      renames[feat.id] ||
      renames[feat.id.toLowerCase()] ||
      renames[feat.id.toUpperCase()] ||
      historicNames1440[feat.id] ||
      baseT.name;
    const resolvedCapId =
      empDef?.capitalTerritoryId &&
      baseBundle.territories[empDef.capitalTerritoryId]
        ? empDef.capitalTerritoryId
        : targetEmpireId;
    const isEmpireCapital = feat.id === resolvedCapId;

    features.push({
      ...feat,
      properties: {
        ...feat.properties,
        name: customName,
      },
    });

    territories[feat.id] = {
      ...baseT,
      name: customName,
      ownerId: targetEmpireId,
      coreOwnerId: targetEmpireId,
      isCapital: isEmpireCapital,
      unrest: 4,
    };
  });

  // 2B. Balance 1440 starting armies and GDP historically so major Eurasian powers lead the world
  const provsByEmpire: Record<string, Territory[]> = {};
  Object.values(territories).forEach((t) => {
    if (!provsByEmpire[t.ownerId]) provsByEmpire[t.ownerId] = [];
    provsByEmpire[t.ownerId].push(t);
  });

  Object.entries(provsByEmpire).forEach(([empId, provs]) => {
    const scaleTarget = TARGET_1440_EMPIRE_SCALE[empId];
    if (!scaleTarget || provs.length === 0) return;

    const currentArmy = provs.reduce((s, p) => s + p.garrison, 0) || 1;
    const currentGdp = provs.reduce((s, p) => s + p.baseGdp, 0) || 1;
    const armyFactor = scaleTarget.targetArmy / currentArmy;
    const gdpFactor = scaleTarget.targetGdp / currentGdp;

    provs.forEach((p) => {
      const nextGarrison = Math.max(
        p.isCapital ? 6500 : 2800,
        Math.round(p.garrison * armyFactor)
      );
      const armor = Math.round(nextGarrison * 0.18);
      const airDrone = Math.round(nextGarrison * 0.08);
      const infantry = Math.max(1000, nextGarrison - armor - airDrone);
      p.garrison = infantry + armor + airDrone;
      p.units = { infantry, armor, airDrone };
      p.baseGdp = Math.max(
        p.isCapital ? 55 : 22,
        Math.round(p.baseGdp * gdpFactor)
      );
    });
  });

  // 3. Clean up neighbor links and ensure every province has >=2 neighbors
  const validProvIds = Object.keys(territories);
  const validSet = new Set(validProvIds);

  validProvIds.forEach((pId) => {
    territories[pId].neighbors = territories[pId].neighbors.filter((nId) =>
      validSet.has(nId)
    );
  });

  const link1440 = (a: string, b: string) => {
    if (!a || !b || a === b || !territories[a] || !territories[b]) return;
    if (!territories[a].neighbors.includes(b)) {
      territories[a].neighbors.push(b);
    }
    if (!territories[b].neighbors.includes(a)) {
      territories[b].neighbors.push(a);
    }
  };

  HISTORICAL_STRAIT_LINKS_1440.forEach(([a, b]) => link1440(a, b));
  STRATEGIC_STRAITS.forEach((st) => {
    st.crossingEdges.forEach(([a, b]) => link1440(a, b));
  });

  validProvIds.forEach((pId) => {
    if (territories[pId].neighbors.length < 2) {
      const cA = territories[pId].centroid;
      validProvIds
        .filter((otherId) => otherId !== pId)
        .map((otherId) => {
          const cB = territories[otherId].centroid;
          return {
            otherId,
            distSq: (cA[0] - cB[0]) ** 2 + (cA[1] - cB[1]) ** 2,
          };
        })
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, 3)
        .forEach((item) => link1440(pId, item.otherId));
    }
  });

  // 4. Historical 1440 Diplomatic Relations (authored via readable tags in scenario1440.json)
  const relations: Record<string, DiplomaticRelation> = {};
  const setRel = (
    aTagOrId: string,
    bTagOrId: string,
    partial: Partial<DiplomaticRelation>
  ) => {
    const a = resolveNationRuntimeId(aTagOrId, '1440');
    const b = resolveNationRuntimeId(bTagOrId, '1440');
    if (!nations[a] || !nations[b]) return;
    const key = relationKey(a, b);
    const nationA = a < b ? a : b;
    const nationB = a < b ? b : a;
    const embargoingNationIds =
      partial.embargoingNationIds ??
      (partial.hasEmbargo ? [nationA] : []);
    relations[key] = {
      nationA,
      nationB,
      score: partial.score ?? 0,
      isAllied: partial.isAllied ?? false,
      allianceType:
        partial.allianceType ?? (partial.isAllied ? 'OFFENSIVE' : null),
      hasNonAggression: partial.hasNonAggression ?? false,
      hasTradeAgreement: partial.hasTradeAgreement ?? false,
      hasEmbargo: embargoingNationIds.length > 0,
      embargoingNationIds,
      hasMilitaryAccess: partial.hasMilitaryAccess ?? false,
      truceUntilTick: 0,
    };
  };

  STARTING_RELATIONS_1440.forEach(([aTag, bTag, opts]) =>
    setRel(aTag, bTag, opts)
  );

  deconflictNeighborColors(nations, territories, 58);

  return {
    features,
    nations,
    territories,
    relations,
  };
}
