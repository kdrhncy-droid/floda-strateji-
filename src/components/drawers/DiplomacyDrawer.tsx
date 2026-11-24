import React, { useMemo, useState } from "react";
import { AlertTriangle, Handshake, Shield, Swords } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import {
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
} from "../../engine/simulationEngine";
import {
  getNationNotableLords,
  getNationRulerName,
} from "../../engine/pashaAndFiefEngine";
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from "../../engine/seasonSupplyAndAiProfile";
import { NationFlagCanvasBadge } from "../../map/nationFlagRenderer";
import { cleanNationName } from "../../utils/formatters";
import { Nation, Territory } from "../../types/game";
import { computeNationTechMetrics } from "../../data/world2026Data";

export const DiplomacyDrawer: React.FC<CommandDrawersProps> = ({
  onClose,
  playerNation,
  territories,
  nations,
  relations,
  wars,
  movements,
  onDiplomaticAction,
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
    <div className="space-y-4">
      {/* Diplomacy Points & Aggressive Expansion Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#caa15a]/35 bg-[#16120e] px-3.5 py-2.5 text-xs">
        <span className="text-[#f3ead7] font-semibold">
          Diplomasi Puanı:{' '}
          <strong className="font-mono-num text-amber-300">
            {(playerNation.diplomacyPoints ?? 100).toFixed(0)} / 100
          </strong>
          <span className="hidden sm:inline text-[#b8a990] font-normal ml-2">
            (Günlük +1 · Savaş ilanı: 10 DP)
          </span>
        </span>
        <span className="text-[#d8cbb5]">
          Agresif Genişleme:{' '}
          <strong
            className={`font-mono-num ${
              playerNation.aggressiveExpansion >= 50
                ? 'text-rose-400'
                : 'text-emerald-300'
            }`}
          >
            %{playerNation.aggressiveExpansion.toFixed(0)} / 100
          </strong>
        </span>
      </div>

      {/* Dedicated Alliance & Coalition Network Panel */}
      <div
        data-testid="diplomacy-alliance-hub"
        className="bg-[#16120e] border border-[#caa15a]/40 rounded-2xl p-3.5 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
            <Handshake className="w-4 h-4 text-[#e0b86e]" />
            <span>İttifak Ağı &amp; Aktif Paktlar</span>
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-num">
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/35 text-emerald-300 font-bold">
              ⚔️ Tam İttifak: {pactSummary.offensiveCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1f1913] border border-[#caa15a]/35 text-[#f3ead7] font-bold">
              🛡️ Savunma Paktı: {pactSummary.defensiveCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1f1913] border border-[#caa15a]/35 text-amber-300 font-bold">
              🪙 Ticaret: {pactSummary.tradeCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1f1913] border border-[#caa15a]/35 text-[#d8cbb5] font-bold">
              🕊️ Saldırmazlık: {pactSummary.nonAggressionCount}
            </span>
          </div>
        </div>

        {pactSummary.allies.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            Henüz resmi bir ittifakınız veya savunma paktınız yok. Aşağıdaki devlet kartlarından <strong>🛡️ Savunma Paktı</strong> (saldırıya uğrayınca koruma) veya <strong>⚔️ Tam İttifak</strong> (ortak taarruz) kurabilirsiniz.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                  className="bg-slate-950/85 border border-emerald-500/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <NationFlagCanvasBadge
                      nationId={ally.id}
                      flagCode={ally.flagCode}
                      color={ally.color}
                      width={32}
                      height={22}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {cleanNationName(ally.name)}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-300">
                        {kind === 'OFFENSIVE'
                          ? '⚔️ Tam İttifak (Saldırı & Savunma)'
                          : kind === 'VASSAL'
                          ? '👑 Tâbi Vasal Devlet'
                          : '🛡️ Savunma Paktı'}
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
                        className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-[10px] font-extrabold shadow transition-colors cursor-pointer"
                      >
                        📯 Savaşa Çağır
                      </button>
                    )}
                    {onInspectNation && (
                      <button
                        type="button"
                        onClick={() => onInspectNation(ally.id)}
                        className="px-2 py-1 rounded-lg bg-[#1c1610] hover:bg-[#271f17] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                      >
                        Detay
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
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-3.5 space-y-2.5">
          <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Aktif Savaşlar ve Barış Masası
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
                  className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {cleanNationName(att?.name || '')} vs {cleanNationName(def?.name || '')}
                    </span>
                    <span
                      className={`font-mono-num text-xs font-bold shrink-0 ${
                        playerWarScore >= 20
                          ? 'text-emerald-400'
                          : playerWarScore <= -20
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      Skor: {playerWarScore > 0 ? `+${playerWarScore}` : playerWarScore}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Kayıplar: Saldırgan {(w.casualtiesAttacker / 1000).toFixed(1)}B · Savunan{' '}
                    {(w.casualtiesDefender / 1000).toFixed(1)}B
                  </div>
                  {isPlayerInvolved && (
                    <button
                      onClick={() => {
                        if (onOpenWarModal) {
                          onOpenWarModal(w.id);
                        } else {
                          onPeaceDeal(w.id, 'WHITE_PEACE');
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 text-xs font-extrabold shadow flex items-center justify-center gap-1.5"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>⚔️ Savaş & Barış Masasını Aç</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'ALL', label: 'Tüm Devletler' },
            { id: 'ALLIES', label: `İttifaklar (${pactSummary.allies.length})` },
            { id: 'NEIGHBORS', label: 'Sınır Komşuları' },
            { id: 'WARS', label: 'Gerginlik & Savaş' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            data-testid={`diplo-filter-${f.id}`}
            onClick={() => setDiploFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              diploFilter === f.id
                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] font-bold'
                : 'bg-[#16120e] text-[#d8cbb5] border border-[#caa15a]/30 hover:border-[#caa15a]/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Unified Nation Diplomacy & Ruler Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {orderedRealms.length === 0 ? (
          <div className="col-span-full p-6 text-center rounded-2xl bg-[#16120e] border border-[#caa15a]/25 text-xs text-[#b8a990]">
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
            const notableLords = getNationNotableLords(realm, ownedProvs, gameMode);
            const realmPersonality = !isPlayer
              ? AI_PERSONALITY_META[resolveNationAiPersonality(realm, territories)]
              : null;
            const realmTech = computeNationTechMetrics(
              realm,
              territories,
              gameMode
            );

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
                className={`relative overflow-hidden rounded-2xl p-4 space-y-3 border transition-all ${
                  isPlayer
                    ? 'bg-[#1f1811] border-[#caa15a]/75 shadow-lg ring-1 ring-[#caa15a]/35'
                    : war
                    ? 'bg-rose-950/25 border-rose-500/50 shadow-md'
                    : rel?.allianceType || rel?.isAllied
                    ? 'bg-emerald-950/20 border-emerald-500/45'
                    : 'bg-[#15110d] border-[#caa15a]/30'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: realm.color }}
                  aria-hidden="true"
                />

                {/* Header */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <NationFlagCanvasBadge
                      nationId={realm.id}
                      flagCode={realm.flagCode}
                      color={realm.color}
                      width={42}
                      height={28}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#f3ead7] truncate flex items-center gap-1.5">
                        <span>{cleanNationName(realm.name)}</span>
                        {isPlayer && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#caa15a] text-[#14100c] font-black">
                            DEVLETİNİZ
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-amber-300 truncate flex items-center gap-1.5">
                        <span className="truncate">👑 {rulerTitle}</span>
                        {realmPersonality && (
                          <span
                            className="text-[10px] font-medium text-[#c5b79e] shrink-0"
                            title={realmPersonality.description}
                          >
                            · {realmPersonality.shortLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isPlayer ? (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#caa15a]/20 border border-[#caa15a]/45 text-amber-200">
                        Hükümdarsınız
                      </span>
                    ) : war ? (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-950/75 border border-rose-500/50 text-rose-200">
                        ⚔️ Savaşta ({playerWarScore !== null && playerWarScore > 0 ? '+' : ''}
                        {playerWarScore ?? war.attackerWarScore}%)
                      </span>
                    ) : rel?.allianceType === 'OFFENSIVE' ? (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-950/75 border border-emerald-500/50 text-emerald-200">
                        ⚔️ Tam İttifak
                      </span>
                    ) : rel?.allianceType === 'DEFENSIVE' || rel?.isAllied ? (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-950/55 border border-emerald-500/40 text-emerald-200">
                        🛡️ Savunma Paktı
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#1c1610] border border-[#caa15a]/30 text-[#d8cbb5]">
                        🕊️ İlişki {rel?.score && rel.score > 0 ? `+${rel.score}` : rel?.score || 0}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4 Stat Metrics: Altın (Hazine), Toplam Ordu (Asker), Teknoloji Düzeyi, Başkent & Eyalet */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-[#1b1510] rounded-xl p-2 border border-[#caa15a]/25">
                    <div className="text-[10px] text-[#b8a990] font-medium">Altın (Hazine)</div>
                    <div
                      data-testid={`diplo-gold-${realm.id}`}
                      className="text-xs sm:text-sm font-bold text-amber-300 font-mono-num"
                    >
                      {Math.floor(realm.treasury).toLocaleString('tr-TR')} A
                    </div>
                  </div>
                  <div className="bg-[#1b1510] rounded-xl p-2 border border-[#caa15a]/25">
                    <div className="text-[10px] text-[#b8a990] font-medium">Toplam Ordu</div>
                    <div
                      data-testid={`diplo-army-${realm.id}`}
                      className="text-xs sm:text-sm font-bold text-emerald-300 font-mono-num"
                    >
                      {totalArmy.toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <div className="bg-[#1b1510] rounded-xl p-2 border border-[#caa15a]/25">
                    <div className="text-[10px] text-[#b8a990] font-medium">Teknoloji</div>
                    <div className="text-xs sm:text-sm font-bold text-[#f3ead7] font-mono-num">
                      Sv.{realmTech.techLevel.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-[#1b1510] rounded-xl p-2 border border-[#caa15a]/25">
                    <div className="text-[10px] text-[#b8a990] font-medium">Başkent &amp; Toprak</div>
                    <div className="text-xs sm:text-sm font-bold text-[#f3ead7] font-mono-num">
                      Bşk.{realmTech.capitalLevel} · {ownedProvs.length} Ey.
                    </div>
                  </div>
                </div>

                {/* Notable Commanders */}
                <div className="bg-[#19140f] rounded-xl p-2.5 border border-[#caa15a]/20 space-y-1.5">
                  <div className="text-[11px] font-bold text-[#d8cbb5] flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Swords className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Paşalar &amp; Komutanlar ({notableLords.length})</span>
                    </span>
                    <span className="text-[10px] text-[#b8a990] font-mono-num">
                      Prestij {realmTech.prestige}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
                    {notableLords.length > 0 ? (
                      notableLords.map((lordName) => (
                        <span
                          key={lordName}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#221b14] border border-[#caa15a]/25 text-[#f3ead7]"
                        >
                          ⚜ {lordName}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[#8e806a] italic">
                        Merkez garnizon idaresi.
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions — Cohesive AoH3 Obsidian & Antique Gold / Emerald / Crimson Palette */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {!isPlayer && (
                    <>
                      <button
                        onClick={() => onDiplomaticAction(realm.id, 'IMPROVE')}
                        title="İlişkileri Geliştir (+20 İlişki · 150 Altın)"
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#251d15] border border-[#caa15a]/35 text-[11px] font-semibold text-[#f3ead7] shrink-0 cursor-pointer"
                      >
                        +İlişki
                      </button>

                      <button
                        onClick={() => onDiplomaticAction(realm.id, 'DEFENSIVE_PACT')}
                        title="Savunma Paktı: Saldırıya uğrandığında otomatik savunma desteği (+25 İlişki)"
                        className={`min-h-[38px] py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          rel?.allianceType === 'DEFENSIVE'
                            ? 'bg-emerald-950/65 border-emerald-500/50 text-emerald-200'
                            : 'bg-[#1b1510] hover:bg-[#251d15] border-[#caa15a]/35 text-[#f3ead7]'
                        }`}
                      >
                        <Shield className="w-3 h-3 shrink-0 text-[#e0b86e]" />
                        <span>
                          {rel?.allianceType === 'DEFENSIVE' ? 'Savunma Aktif' : 'Savunma'}
                        </span>
                      </button>

                      <button
                        onClick={() => onDiplomaticAction(realm.id, 'OFFENSIVE_PACT')}
                        title="Tam İttifak (Saldırı Paktı): Ortak taarruz & tam savunma (+45 İlişki)"
                        className={`min-h-[38px] py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          rel?.allianceType === 'OFFENSIVE'
                            ? 'bg-emerald-950/75 border-emerald-400 text-emerald-100'
                            : 'bg-[#1b1510] hover:bg-[#251d15] border-[#caa15a]/35 text-[#f3ead7]'
                        }`}
                      >
                        <Handshake className="w-3 h-3 shrink-0 text-[#e0b86e]" />
                        <span>
                          {rel?.allianceType === 'OFFENSIVE' ? 'İttifak Aktif' : 'Tam İttifak'}
                        </span>
                      </button>

                      {war ? (
                        <button
                          onClick={() => {
                            if (onOpenWarModal) {
                              onOpenWarModal(war.id);
                            } else {
                              onPeaceDeal(war.id, 'WHITE_PEACE');
                            }
                          }}
                          className="flex-1 min-h-[38px] py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>⚔️ Barış Masası</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onDiplomaticAction(realm.id, 'DECLARE_WAR')}
                          className="flex-1 min-h-[38px] py-1.5 px-2.5 rounded-xl bg-rose-950/75 hover:bg-rose-900/80 border border-rose-500/50 text-rose-100 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>⚔️ Savaş</span>
                        </button>
                      )}
                    </>
                  )}

                  {onInspectNation && (
                    <button
                      onClick={() => onInspectNation(realm.id)}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#251d15] text-[#f3ead7] text-[11px] font-bold border border-[#caa15a]/35 shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Ülkenin tüm pakt, ittifak ve savaşlarını gör"
                    >
                      <span>🌐 Detay</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const capId = realm.capitalTerritoryId || ownedProvs[0]?.id;
                      if (capId) {
                        onSelectTerritory(capId);
                        onClose();
                      }
                    }}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#251d15] text-[#e0b86e] text-[11px] font-bold border border-[#caa15a]/35 shrink-0 flex items-center gap-1 cursor-pointer"
                    title="Haritada Odaklan"
                  >
                    <span>📍</span>
                  </button>
                </div>

                {/* Covert Espionage & Sabotage Row (AoH3 Dark Gold/Obsidian Theme) */}
                {!isPlayer && (
                  <div className="pt-1.5 border-t border-[#caa15a]/15 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#b8a990] uppercase tracking-wider mr-1">
                      🕵️ Casusluk:
                    </span>
                    <button
                      data-testid={`diplo-spy-fort-${realm.id}`}
                      onClick={() =>
                        onDiplomaticAction(realm.id, 'ESPIONAGE_SABOTAGE_FORT')
                      }
                      title="Kale Sabotajı (25 DP · 220 Altın): Düşman kalesinin surlarını %35'e indirir ve garnizonu yıpratır"
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#19130e] hover:bg-[#251c14] border border-[#caa15a]/30 text-[10px] font-semibold text-[#f3ead7] cursor-pointer"
                    >
                      🏰 Kale Sabotajı (220A)
                    </button>
                    <button
                      data-testid={`diplo-spy-revolt-${realm.id}`}
                      onClick={() =>
                        onDiplomaticAction(realm.id, 'ESPIONAGE_INCITE_REVOLT')
                      }
                      title="İsyan Kışkırtma (30 DP · 260 Altın): Hedef eyalette huzursuzluğu +42 artırır ve milis ayaklanması çıkarır"
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#19130e] hover:bg-[#251c14] border border-[#caa15a]/30 text-[10px] font-semibold text-[#f3ead7] cursor-pointer"
                    >
                      🔥 İsyan Kışkırt (260A)
                    </button>
                    <button
                      data-testid={`diplo-spy-siphon-${realm.id}`}
                      onClick={() =>
                        onDiplomaticAction(realm.id, 'ESPIONAGE_SIPHON_TREASURY')
                      }
                      title="Hazine & Bilim Sızdır (20 DP · 150 Altın): Hedef hazineden altın ve +35 Araştırma Puanı sızdırır"
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#19130e] hover:bg-[#251c14] border border-[#caa15a]/30 text-[10px] font-semibold text-amber-200 cursor-pointer"
                    >
                      📜 Hazine &amp; Bilim Sızdır (150A)
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
