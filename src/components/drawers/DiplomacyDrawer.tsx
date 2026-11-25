import React, { useMemo, useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import {
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
} from "../../engine/simulationEngine";
import { getNationRulerName } from "../../engine/pashaAndFiefEngine";
import { NationFlagCanvasBadge } from "../../map/nationFlagRenderer";
import { cleanNationName, formatTroopsShort } from "../../utils/formatters";
import { Nation, Territory } from "../../types/game";
import { AoH3GlyphSvg, AoH3MenuBanner } from "../illustrations/AoH3Illustrations";

export const DiplomacyDrawer: React.FC<CommandDrawersProps> = ({
  onClose,
  playerNation,
  territories,
  nations,
  relations,
  wars,
  movements,
  onPeaceDeal,
  onSelectTerritory,
  onInspectNation,
  onOpenWarModal,
  onCallAllyToWar,
  gameMode = "EMPIRES_1440",
}) => {
  const [diploFilter, setDiploFilter] = useState<"ALL" | "ALLIES" | "NEIGHBORS" | "WARS">("ALL");

  const { provsByNation, marchingByNation, neighborNationIds } = useMemo(() => {
    const provMap = new Map<string, Territory[]>();
    const troopMap = new Map<string, number>();
    const neighbors = new Set<string>();

    for (const t of Object.values(territories)) {
      if (!t) continue;
      const list = provMap.get(t.ownerId);
      if (list) list.push(t);
      else provMap.set(t.ownerId, [t]);

      if (t.ownerId === playerNation.id) {
        for (const nbId of t.neighbors) {
          const nbOwner = territories[nbId]?.ownerId;
          if (nbOwner && nbOwner !== playerNation.id) {
            neighbors.add(nbOwner);
          }
        }
      }
    }

    for (const mv of movements) {
      troopMap.set(mv.ownerId, (troopMap.get(mv.ownerId) || 0) + mv.troops);
    }

    return {
      provsByNation: provMap,
      marchingByNation: troopMap,
      neighborNationIds: neighbors,
    };
  }, [territories, movements, playerNation.id]);

  const pactSummary = useMemo(() => {
    const allies: {
      nation: Nation;
      kind: 'OFFENSIVE' | 'DEFENSIVE' | 'VASSAL';
    }[] = [];
    let tradeCount = 0;
    let nonAggressionCount = 0;

    for (const n of Object.values(nations)) {
      if (!n || n.id === playerNation.id || n.isEliminated) continue;
      const rel = getOrCreateRelation(relations, playerNation.id, n.id);
      if (rel.hasTradeAgreement) tradeCount += 1;
      if (rel.hasNonAggression) nonAggressionCount += 1;

      if (n.vassalOf === playerNation.id) {
        allies.push({ nation: n, kind: 'VASSAL' });
      } else if (rel.allianceType === 'OFFENSIVE') {
        allies.push({ nation: n, kind: 'OFFENSIVE' });
      } else if (rel.allianceType === 'DEFENSIVE' || rel.isAllied) {
        allies.push({ nation: n, kind: 'DEFENSIVE' });
      }
    }

    allies.sort((a, b) => {
      const rank = (k: 'OFFENSIVE' | 'DEFENSIVE' | 'VASSAL') =>
        k === 'OFFENSIVE' ? 0 : k === 'VASSAL' ? 1 : 2;
      return rank(a.kind) - rank(b.kind);
    });

    const alliedIdSet = new Set(allies.map((a) => a.nation.id));
    const offensiveCount = allies.filter((a) => a.kind === 'OFFENSIVE').length;
    const defensiveCount = allies.filter((a) => a.kind === 'DEFENSIVE').length;

    return {
      allies,
      alliedIdSet,
      offensiveCount,
      defensiveCount,
      tradeCount,
      nonAggressionCount,
    };
  }, [nations, relations, playerNation.id]);

  const playerWars = useMemo(
    () =>
      wars.filter(
        (w) =>
          w.attackerId === playerNation.id ||
          w.defenderId === playerNation.id ||
          w.attackers.includes(playerNation.id) ||
          w.defenders.includes(playerNation.id)
      ),
    [wars, playerNation.id]
  );

  const orderedRealms = useMemo(() => {
    const others = Object.values(nations)
      .filter((n) => n.id !== playerNation.id && !n.isEliminated)
      .filter((n) => {
        if (diploFilter === "ALLIES") {
          return pactSummary.alliedIdSet.has(n.id);
        }
        if (diploFilter === "NEIGHBORS") {
          return neighborNationIds.has(n.id);
        }
        if (diploFilter === "WARS") {
          const rel = getOrCreateRelation(relations, playerNation.id, n.id);
          return (
            Boolean(isAtWar(wars, playerNation.id, n.id)) ||
            rel.hasEmbargo ||
            rel.score < -15
          );
        }
        return true;
      })
      .sort((a, b) => {
        const aWar = isAtWar(wars, playerNation.id, a.id) ? 1 : 0;
        const bWar = isAtWar(wars, playerNation.id, b.id) ? 1 : 0;
        if (aWar !== bWar) return bWar - aWar;
        const aAllied = pactSummary.alliedIdSet.has(a.id) ? 1 : 0;
        const bAllied = pactSummary.alliedIdSet.has(b.id) ? 1 : 0;
        if (aAllied !== bAllied) return bAllied - aAllied;
        const aProvs = provsByNation.get(a.id)?.length || 0;
        const bProvs = provsByNation.get(b.id)?.length || 0;
        return bProvs - aProvs;
      });

    return diploFilter === "ALL" ? [playerNation, ...others] : others;
  }, [
    nations,
    playerNation,
    diploFilter,
    neighborNationIds,
    pactSummary.alliedIdSet,
    relations,
    wars,
    provsByNation,
  ]);

  return (
    <div className="space-y-3">
      {/* AoH3 Illustrated Oil-Painting Diplomacy Banner */}
      <AoH3MenuBanner
        artKey="COURT"
        branch="ADMINISTRATION"
        title="İmparatorluk Diplomasisi & İttifak Ağı"
        subtitle={`${pactSummary.allies.length} Müttefik · ${playerWars.length} Aktif Savaş`}
        icon="handshake"
        rightSlot={
          <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-[#14100c]/85 border border-[#caa15a]/35 font-mono-num text-[11px]">
            <span className="text-[#e0b86e] font-bold">
              {(playerNation.diplomacyPoints ?? 100).toFixed(0)} DP
            </span>
            <span className="text-[#caa15a]/40">·</span>
            <span
              title="Agresiflik 100'e ulaşırsa bütün dünya size koalisyon savaşı ilan eder"
              className={
                playerNation.aggressiveExpansion >= 90
                  ? 'text-rose-400 font-extrabold animate-pulse'
                  : playerNation.aggressiveExpansion >= 60
                  ? 'text-amber-400 font-bold'
                  : 'text-emerald-400 font-bold'
              }
            >
              Koalisyon {Math.round(playerNation.aggressiveExpansion)}/100
            </span>
          </div>
        }
      />

      {/* Compact Alliance & Pact Network Strip */}
      <div
        data-testid="diplomacy-alliance-hub"
        className="bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-3 space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-display font-bold text-[#f3ead7] flex items-center gap-1.5">
            <AoH3GlyphSvg name="handshake" className="w-4 h-4 text-[#e0b86e]" />
            <span>İttifak &amp; Pakt Ağı</span>
          </h3>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num text-[#d8cbb5]">
            <span className="inline-flex items-center gap-1 text-[#e0b86e] font-bold">
              <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
              <span>{pactSummary.offensiveCount} İttifak</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
              <span>{pactSummary.defensiveCount} Savunma</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <AoH3GlyphSvg name="gold" className="w-3 h-3 text-[#e0b86e] shrink-0" />
              <span>{pactSummary.tradeCount} Ticaret</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <AoH3GlyphSvg name="dove" className="w-3 h-3 text-[#e0b86e] shrink-0" />
              <span>{pactSummary.nonAggressionCount} Saldırmazlık</span>
            </span>
          </div>
        </div>

        {pactSummary.allies.length === 0 ? (
          <div className="text-[11px] text-[#9e907a]">
            Aktif ittifak yok — aşağıdan ülke inceleyerek pakt kurun.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {pactSummary.allies.map(({ nation: ally, kind }) => {
              const callableWar = playerWars.find(
                (w) =>
                  !w.attackers.includes(ally.id) &&
                  !w.defenders.includes(ally.id)
              );
              const callableEnemy = callableWar
                ? nations[
                    callableWar.attackerId === playerNation.id ||
                    callableWar.attackers.includes(playerNation.id)
                      ? callableWar.defenderId
                      : callableWar.attackerId
                  ]
                : null;

              return (
                <div
                  key={ally.id}
                  className="bg-[#1b1510] border border-[#caa15a]/45 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <NationFlagCanvasBadge
                      nationId={ally.id}
                      flagCode={ally.flagCode}
                      color={ally.color}
                      width={28}
                      height={19}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#f3ead7] truncate">
                        {cleanNationName(ally.name)}
                      </div>
                      <div className="text-[10px] font-semibold text-[#e0b86e] flex items-center gap-1 truncate">
                        <AoH3GlyphSvg
                          name={
                            kind === 'OFFENSIVE'
                              ? 'sword'
                              : kind === 'VASSAL'
                              ? 'crown'
                              : 'shield'
                          }
                          className="w-3 h-3 shrink-0"
                        />
                        <span>
                          {kind === 'OFFENSIVE'
                            ? 'Tam İttifak'
                            : kind === 'VASSAL'
                            ? 'Vasal'
                            : 'Savunma Paktı'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {callableWar && onCallAllyToWar && (
                      <button
                        type="button"
                        data-testid={`call-ally-${ally.id}`}
                        onClick={() => onCallAllyToWar(callableWar.id, ally.id)}
                        title={`${cleanNationName(ally.name)} müttefikini ${cleanNationName(callableEnemy?.name || 'düşman')} savaşına çağır`}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-[10.5px] font-extrabold shadow flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <AoH3GlyphSvg name="horn" className="w-3 h-3 shrink-0" />
                        <span>Çağır</span>
                      </button>
                    )}
                    {onInspectNation && (
                      <button
                        type="button"
                        onClick={() => onInspectNation(ally.id)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#231c15] hover:bg-[#2d241b] border border-[#caa15a]/35 text-[#f3ead7] text-[10.5px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        İncele
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Wars & Peace Table */}
      {wars.length > 0 && (
        <div className="bg-rose-950/25 border border-rose-500/40 rounded-2xl p-3 space-y-2">
          <h3 className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
            <AoH3GlyphSvg name="alert" className="w-3.5 h-3.5 text-rose-400" />
            <span>Aktif Savaşlar</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {wars.map((w) => {
              const att = nations[w.attackerId];
              const def = nations[w.defenderId];
              const isPlayerInvolved =
                w.attackers.includes(playerNation.id) ||
                w.defenders.includes(playerNation.id);
              const playerWarScore =
                getWarScoreForNation(w, playerNation.id) ?? w.attackerWarScore;
              return (
                <div
                  key={w.id}
                  className="bg-[#16110e] border border-rose-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#f3ead7] truncate">
                      {cleanNationName(att?.name || '')} vs {cleanNationName(def?.name || '')}
                    </div>
                    <div className="text-[10.5px] font-mono-num text-[#b8a990] flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          playerWarScore >= 20
                            ? 'text-emerald-400'
                            : playerWarScore <= -20
                            ? 'text-rose-400'
                            : 'text-[#e0b86e]'
                        }`}
                      >
                        {playerWarScore > 0 ? `+${playerWarScore}` : playerWarScore}%
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Kayıp {(w.casualtiesAttacker / 1000).toFixed(1)}B / {(w.casualtiesDefender / 1000).toFixed(1)}B
                      </span>
                    </div>
                  </div>
                  {isPlayerInvolved && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenWarModal) {
                          onOpenWarModal(w.id);
                        } else {
                          onPeaceDeal(w.id, 'WHITE_PEACE');
                        }
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-xs font-extrabold shadow flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5" />
                      <span>Barış</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(
          [
            { id: 'ALL', label: `Tümü (${Object.values(nations).filter((n) => !n.isEliminated).length})` },
            { id: 'ALLIES', label: `İttifaklar (${pactSummary.allies.length})` },
            { id: 'NEIGHBORS', label: 'Komşular' },
            { id: 'WARS', label: 'Savaş & Gerginlik' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={`diplo-filter-${f.id}`}
            onClick={() => setDiploFilter(f.id)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              diploFilter === f.id
                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] font-bold'
                : 'bg-[#16120e] text-[#d8cbb5] border border-[#caa15a]/30 hover:border-[#caa15a]/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Compact AoH3 Nation Rows */}
      <div className="space-y-1.5 max-h-[470px] overflow-y-auto pr-1">
        {orderedRealms.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-[#16120e] border border-[#caa15a]/25 text-xs text-[#b8a990]">
            Bu filtreye uygun devlet bulunmuyor.
          </div>
        ) : (
          orderedRealms.map((realm) => {
            const isPlayer = realm.id === playerNation.id;
            const rulerTitle = getNationRulerName(realm.id, gameMode);
            const ownedProvs = provsByNation.get(realm.id) || [];
            const totalGarrison = ownedProvs.reduce(
              (sum, t) => sum + (t.garrison || 0),
              0
            );
            const totalArmy = totalGarrison + (marchingByNation.get(realm.id) || 0);
            const rel = isPlayer
              ? null
              : getOrCreateRelation(relations, playerNation.id, realm.id);
            const war = isPlayer
              ? null
              : isAtWar(wars, playerNation.id, realm.id);
            const playerWarScore = war
              ? getWarScoreForNation(war, playerNation.id)
              : null;

            return (
              <div
                key={realm.id}
                data-testid={`diplomacy-nation-card-${realm.id}`}
                className={`relative overflow-hidden rounded-xl px-3 py-2 border flex items-center justify-between gap-2 transition-colors ${
                  isPlayer
                    ? 'bg-[#211910] border-[#e0b86e]'
                    : war
                    ? 'bg-rose-950/25 border-rose-500/45'
                    : rel?.allianceType || rel?.isAllied
                    ? 'bg-[#1c1610] border-[#caa15a]/55'
                    : 'bg-[#15110d] border-[#caa15a]/25 hover:border-[#caa15a]/50'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: realm.color }}
                  aria-hidden="true"
                />

                {/* Left: Flag + Country Name + Inline Compact Telemetry */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
                  <NationFlagCanvasBadge
                    nationId={realm.id}
                    flagCode={realm.flagCode}
                    color={realm.color}
                    width={34}
                    height={23}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#f3ead7] truncate">
                        {cleanNationName(realm.name)}
                      </span>
                      {isPlayer && (
                        <span className="text-[10px] font-black text-[#e0b86e] shrink-0">
                          · SİZ
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#b8a990] font-mono-num flex items-center gap-x-1.5 truncate">
                      <span className="font-sans text-[#d8cbb5] truncate max-w-[115px] sm:max-w-[160px]">
                        {rulerTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        data-testid={`diplo-army-${realm.id}`}
                        className="inline-flex items-center gap-1 text-[#f3ead7] font-semibold shrink-0"
                      >
                        <AoH3GlyphSvg name="sword" className="w-2.5 h-2.5 text-[#e0b86e]" />
                        <span>{formatTroopsShort(totalArmy)}</span>
                      </span>
                      <span aria-hidden="true" className="hidden xs:inline">·</span>
                      <span
                        data-testid={`diplo-gold-${realm.id}`}
                        className="hidden xs:inline text-[#e0b86e] shrink-0"
                      >
                        {Math.floor(realm.treasury).toLocaleString('tr-TR')}A
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{ownedProvs.length} Ey.</span>
                    </div>
                  </div>
                </div>

                {/* Right: Relation/War Badge + Map Focus + 1-Tap Inspect */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="hidden sm:flex items-center text-[11px] font-mono-num font-bold mr-1">
                    {isPlayer ? (
                      <span className="text-[#e0b86e] inline-flex items-center gap-1">
                        <AoH3GlyphSvg name="crown" className="w-3 h-3" />
                        <span>Hükümdar</span>
                      </span>
                    ) : war ? (
                      <span className="text-rose-300 inline-flex items-center gap-1">
                        <AoH3GlyphSvg name="sword" className="w-3 h-3" />
                        <span>
                          {(playerWarScore ?? war.attackerWarScore) > 0
                            ? `+${playerWarScore ?? war.attackerWarScore}`
                            : playerWarScore ?? war.attackerWarScore}
                          %
                        </span>
                      </span>
                    ) : rel?.allianceType === 'OFFENSIVE' ? (
                      <span className="text-[#e0b86e] inline-flex items-center gap-1">
                        <AoH3GlyphSvg name="sword" className="w-3 h-3" />
                        <span>İttifak</span>
                      </span>
                    ) : rel?.allianceType === 'DEFENSIVE' || rel?.isAllied ? (
                      <span className="text-[#e0b86e] inline-flex items-center gap-1">
                        <AoH3GlyphSvg name="shield" className="w-3 h-3" />
                        <span>Savunma</span>
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          (rel?.score ?? 0) >= 25
                            ? 'text-emerald-400'
                            : (rel?.score ?? 0) <= -25
                            ? 'text-rose-400'
                            : 'text-[#d8cbb5]'
                        }`}
                      >
                        <AoH3GlyphSvg name="dove" className="w-3 h-3 text-[#e0b86e]" />
                        <span>{(rel?.score ?? 0) > 0 ? `+${rel?.score}` : (rel?.score ?? 0)}</span>
                      </span>
                    )}
                  </div>

                  {/* Mobile Compact Status Score */}
                  <div className="sm:hidden text-[11px] font-mono-num font-bold shrink-0">
                    {isPlayer ? (
                      <AoH3GlyphSvg name="crown" className="w-3.5 h-3.5 text-[#e0b86e]" />
                    ) : war ? (
                      <span className="text-rose-300 inline-flex items-center gap-0.5">
                        <AoH3GlyphSvg name="sword" className="w-3 h-3" />
                        <span>
                          {(playerWarScore ?? war.attackerWarScore) > 0
                            ? `+${playerWarScore ?? war.attackerWarScore}`
                            : playerWarScore ?? war.attackerWarScore}
                          %
                        </span>
                      </span>
                    ) : rel?.allianceType === 'OFFENSIVE' ? (
                      <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-[#e0b86e]" />
                    ) : rel?.allianceType === 'DEFENSIVE' || rel?.isAllied ? (
                      <AoH3GlyphSvg name="shield" className="w-3.5 h-3.5 text-[#e0b86e]" />
                    ) : (
                      <span
                        className={
                          (rel?.score ?? 0) >= 25
                            ? 'text-emerald-400'
                            : (rel?.score ?? 0) <= -25
                            ? 'text-rose-400'
                            : 'text-[#d8cbb5]'
                        }
                      >
                        {(rel?.score ?? 0) > 0 ? `+${rel?.score}` : (rel?.score ?? 0)}
                      </span>
                    )}
                  </div>

                  {war && onOpenWarModal && (
                    <button
                      type="button"
                      onClick={() => onOpenWarModal(war.id)}
                      className="min-h-[44px] px-2.5 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-[11px] font-extrabold whitespace-nowrap cursor-pointer"
                    >
                      Barış
                    </button>
                  )}

                  {onInspectNation && (
                    <button
                      type="button"
                      data-testid={`diplo-inspect-${realm.id}`}
                      onClick={() => onInspectNation(realm.id)}
                      className="min-h-[44px] px-3 rounded-lg bg-[#231c15] hover:bg-[#30261d] border border-[#caa15a]/45 text-[#f3ead7] text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <span>İncele</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#caa15a]" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const capId = realm.capitalTerritoryId || ownedProvs[0]?.id;
                      if (capId) {
                        onSelectTerritory(capId);
                        onClose();
                      }
                    }}
                    aria-label={`${cleanNationName(realm.name)} başkentini haritada göster`}
                    title="Haritada Odaklan"
                    className="min-w-[44px] min-h-[44px] rounded-lg bg-[#1b1510] hover:bg-[#271f17] border border-[#caa15a]/30 text-[#e0b86e] flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
