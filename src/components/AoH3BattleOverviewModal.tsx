import React, { useMemo, useState } from 'react';
import {
  Swords,
  Shield,
  X,
  Zap,
  Target,
  Flame,
  Castle,
  ArrowRight,
  Handshake,
  Crown,
  Coins,
  Flag,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  ActiveBattle,
  ActiveSiege,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  Territory,
} from '../types/game';
import { NationFlagCanvasBadge } from '../map/nationFlagRenderer';
import { TERRAIN_INFO } from '../engine/pashaAndFiefEngine';
import {
  calculateProvinceDevelopment,
  getOrCreateRelation,
} from '../engine/simulationEngine';
import {
  calculateProvincePeaceScoreCost,
  calculateWarPeaceBudget,
  PeaceConferenceRequest,
} from '../engine/diplomacyAndWarActions';
import { sound } from '../utils/soundEngine';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

interface AoH3BattleOverviewModalProps {
  battle?: ActiveBattle | null;
  siege?: ActiveSiege | null;
  territory: Territory;
  playerNationId: string;
  nations: Record<string, Nation>;
  onClose: () => void;
  onApplyTacticalOrder?: (tactic: 'TURAN' | 'BOMBARD' | 'RETREAT') => void;
}

export const AoH3BattleOverviewModal: React.FC<AoH3BattleOverviewModalProps> = ({
  battle,
  siege,
  territory,
  playerNationId,
  nations,
  onClose,
  onApplyTacticalOrder,
}) => {
  const dialogRef = useAccessibleDialog(Boolean(battle || siege), onClose);
  if (!battle && !siege) return null;

  const attackerId = battle ? battle.attackerId : siege!.attackerId;
  const defenderId = battle ? battle.defenderId : siege!.defenderId;
  const attackerNation = nations[attackerId];
  const defenderNation = nations[defenderId];
  if (!attackerNation || !defenderNation) return null;

  const isPlayerAttacker = attackerId === playerNationId;
  const isPlayerDefender = defenderId === playerNationId;
  const isPlayerInvolved = isPlayerAttacker || isPlayerDefender;
  const canBombardSiegeWalls =
    !battle && Boolean(siege && siege.attackerId === playerNationId);
  const hasTacticalOrders = Boolean(
    (battle && isPlayerInvolved) || canBombardSiegeWalls
  );
  const turanAlreadyUsed = Boolean(
    battle && (isPlayerAttacker ? battle.attackerTuranUsed : battle.defenderTuranUsed)
  );
  const enemyTroopsForPlayer = battle
    ? isPlayerAttacker
      ? battle.defenderTroops
      : battle.attackerTroops
    : 0;
  const bombardmentBelowFloor = Boolean(battle && enemyTroopsForPlayer <= 200);

  const terrainMeta = TERRAIN_INFO[territory.terrain || 'OVA'] || TERRAIN_INFO.OVA;
  const combatWidth = battle?.combatWidth || 25000;

  const attTroops = battle ? battle.attackerTroops : siege!.attackerTroops;
  const defTroops = battle ? battle.defenderTroops : territory.garrison;
  const totalTroops = Math.max(1, attTroops + defTroops);
  const attRatio = Math.max(0.08, Math.min(0.92, attTroops / totalTroops));

  const attMorale = battle ? (battle.attackerMorale ?? 100) : 100;
  const defMorale = battle ? (battle.defenderMorale ?? 100) : 100;

  const attFront = battle
    ? (battle.attackerFrontline ?? Math.round(attTroops * 0.8))
    : Math.round(attTroops * 0.75);
  const attBack = battle
    ? (battle.attackerBackline ?? Math.round(attTroops * 0.2))
    : Math.round(attTroops * 0.25);

  const defFront = battle
    ? (battle.defenderFrontline ?? Math.round(defTroops * 0.85))
    : Math.round(defTroops * 0.85);
  const defBack = battle
    ? (battle.defenderBackline ?? Math.round(defTroops * 0.15))
    : Math.round(defTroops * 0.15);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-overview-title"
        tabIndex={-1}
        className="relative w-full max-w-3xl bg-slate-950/95 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-amber-950/50 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {battle ? <Swords className="w-5 h-5 animate-pulse" /> : <Castle className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="battle-overview-title" className="text-base sm:text-lg font-bold font-serif text-amber-200 uppercase tracking-wide">
                  {battle
                    ? `${territory.name} Muharebesi (Canlı Meydan)`
                    : `${territory.name} Kuşatması & Sur Direnişi`}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {battle ? `Tur ${battle.round || 1}` : `%${Math.round(siege?.progress || 0)} Kuşatma`}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{terrainMeta.name}</span>
                <span>•</span>
                <span>Savaş Genişliği: {(combatWidth / 1000).toFixed(0)}B Asker</span>
                <span>•</span>
                <span>Sur Sağlığı: %{territory.castleWallHp ?? 100}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Muharebe veya kuşatma özetini kapat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tug of War Dynamic Balance Bar */}
        <div className="w-full bg-slate-900 h-2.5 relative flex overflow-hidden">
          <div
            className="h-full transition-all duration-300 bg-gradient-to-r from-red-600 to-rose-500"
            style={{ width: `${attRatio * 100}%` }}
          />
          <div
            className="h-full transition-all duration-300 bg-gradient-to-r from-sky-500 to-blue-600"
            style={{ width: `${(1 - attRatio) * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-amber-300 shadow-[0_0_8px_#FBBF24]"
            style={{ left: `${attRatio * 100}%` }}
          />
        </div>

        {/* Content Body: Two Armies Facing Each Other */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attacker Panel */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isPlayerAttacker
                  ? 'bg-emerald-950/25 border-emerald-500/40 shadow-emerald-950/50'
                  : 'bg-red-950/25 border-red-500/40 shadow-red-950/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <NationFlagCanvasBadge
                    nationId={attackerId}
                    flagCode={attackerNation.flagCode}
                    color={attackerNation.color}
                    width={28}
                    height={19}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      {attackerNation.name}
                      {isPlayerAttacker && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          BİZİM ORDU
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Saldıran Taraf • {battle?.attackerCommanderName || 'Hükümdar Sancağı'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold font-mono text-amber-300">
                    {(attTroops / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-slate-400">Aktif Muharip</div>
                </div>
              </div>

              {/* Morale Bar */}
              <div className="space-y-1 mb-3.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-400" /> Ordu Morali
                  </span>
                  <span className="font-bold font-mono text-amber-300">%{attMorale}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.max(5, attMorale)}%` }}
                  />
                </div>
              </div>

              {/* AoH3 Tactical Lines: Frontline & Backline */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
                    🛡️ Ön Hat (Piyade/Süvari)
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">
                    {(attFront / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-slate-400">Göğüs Göğüse Çarpışma</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider mb-0.5">
                    🏹 Arka Hat (Topçu/Şahi)
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">
                    {(attBack / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-slate-400">Menzilli Bombardıman</div>
                </div>
              </div>
            </div>

            {/* Defender Panel */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isPlayerDefender
                  ? 'bg-emerald-950/25 border-emerald-500/40 shadow-emerald-950/50'
                  : 'bg-blue-950/25 border-blue-500/40 shadow-blue-950/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <NationFlagCanvasBadge
                    nationId={defenderId}
                    flagCode={defenderNation.flagCode}
                    color={defenderNation.color}
                    width={28}
                    height={19}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      {defenderNation.name}
                      {isPlayerDefender && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          BİZİM EYALET
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Savunan Taraf • {battle?.defenderCommanderName || 'Müstahkem Garnizon'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold font-mono text-amber-300">
                    {(defTroops / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-slate-400">Savunan Kuvvet</div>
                </div>
              </div>

              {/* Morale Bar */}
              <div className="space-y-1 mb-3.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-400" /> Savunma Azmi
                  </span>
                  <span className="font-bold font-mono text-amber-300">%{defMorale}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-sky-400 transition-all duration-300"
                    style={{ width: `${Math.max(5, defMorale)}%` }}
                  />
                </div>
              </div>

              {/* AoH3 Tactical Lines: Frontline & Backline */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
                    🛡️ Ön Hat (Garnizon)
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">
                    {(defFront / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-slate-400">Siper ve Barikatlar</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider mb-0.5">
                    ♜ Sur & Savunma Kuleleri
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">
                    %{territory.castleWallHp ?? 100}
                  </div>
                  <div className="text-[10px] text-slate-400">Fortress Savunması</div>
                </div>
              </div>
            </div>
          </div>

          {/* Siege Status Banner if territory has active siege */}
          {siege && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Castle className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-amber-200">
                    Kuşatma Çemberi: %{Math.round(siege.progress)} Tamamlandı
                  </div>
                  <div className="text-xs text-slate-300">
                    Surlar zayıflıyor. Kuşatma %100'e ulaştığında kale teslim olacak ve eyalet işgal edilecek.
                  </div>
                </div>
              </div>
              <div className="w-24 text-right">
                <span className="text-xs font-mono font-bold text-amber-300">
                  {(siege.attackerTroops / 1000).toFixed(1)}B Kuşatmacı
                </span>
              </div>
            </div>
          )}

          {/* Tactical Command Action Buttons (Available for Player) */}
          {hasTacticalOrders && onApplyTacticalOrder && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-300 font-medium">
                Komutan Müdahalesi:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {battle && (
                  <>
                    <button
                      disabled={turanAlreadyUsed}
                      onClick={() => {
                        sound.playWarHorn();
                        onApplyTacticalOrder('TURAN');
                      }}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {turanAlreadyUsed
                        ? 'Hilal & Turan (Kullanıldı)'
                        : 'Hilal & Turan Taktiği (+%18 güç)'}
                    </button>
                  </>
                )}
                {(battle || canBombardSiegeWalls) && (
                  <button
                    onClick={() => {
                      sound.playWarHorn();
                      onApplyTacticalOrder('BOMBARD');
                    }}
                    disabled={
                      bombardmentBelowFloor ||
                      (!battle &&
                        (territory.castleWallHp ?? siege?.wallIntegrity ?? 100) <= 0)
                    }
                    title={
                      bombardmentBelowFloor
                        ? 'Hedef kuvvet 200 askerin altında; ilave kayıp oluşturulamaz.'
                        : battle
                        ? 'Düşman askerlerine topçu ateşi uygular; surlara hasar vermez.'
                        : 'Kuşatma surlarının dayanıklılığını azaltır.'
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-sky-500/40 text-sky-300 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Target className="w-3.5 h-3.5" />
                    {battle
                      ? bombardmentBelowFloor
                        ? 'Bombardıman eşiği (200)'
                        : 'Düşman Kuvvetlerini Bombala'
                      : 'Surları Bombala (−20)'}
                  </button>
                )}
                {battle && (
                  <button
                    onClick={() => {
                      sound.playMarch();
                      onApplyTacticalOrder('RETREAT');
                    }}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Düzenli Geri Çekil
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900/80 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            Haritaya Dön
          </button>
        </div>
      </div>
    </div>
  );
};

export interface UnifiedWarAndPeaceModalProps {
  war: ActiveWar;
  playerWars: ActiveWar[];
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  movements: ArmyMovement[];
  tick: number;
  onSelectWar: (warId: string) => void;
  onCallAllyToWar: (warId: string, allyNationId: string) => void;
  onResolvePeaceConference: (request: PeaceConferenceRequest) => void;
  onClose: () => void;
}

export const UnifiedWarAndPeaceModal: React.FC<UnifiedWarAndPeaceModalProps> = ({
  war,
  playerWars,
  playerNationId,
  nations,
  territories,
  relations,
  movements,
  tick,
  onSelectWar,
  onCallAllyToWar,
  onResolvePeaceConference,
  onClose,
}) => {
  const dialogRef = useAccessibleDialog(Boolean(war), onClose);

  const budgetInfo = useMemo(
    () => calculateWarPeaceBudget(war, playerNationId, territories),
    [war, playerNationId, territories]
  );

  const {
    signedWarScore,
    occupiedEnemyProvinces,
    claimableEnemyProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  } = budgetInfo;

  // Default selection: pre-select any occupied enemy provinces that fit in the current budget
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>(() =>
    occupiedEnemyProvinces.map((t) => t.id)
  );
  const [demandVassal, setDemandVassal] = useState<boolean>(false);
  const [demandTribute, setDemandTribute] = useState<boolean>(false);
  const [demandReparations, setDemandReparations] = useState<boolean>(false);

  const playerNation = nations[playerNationId];
  const enemyNation = nations[enemyNationId];

  const playerSideIds = isPlayerAttackerSide ? war.attackers : war.defenders;
  const enemySideIds = isPlayerAttackerSide ? war.defenders : war.attackers;

  const armyByNation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of Object.values(territories)) {
      if (!t?.ownerId) continue;
      map[t.ownerId] = (map[t.ownerId] || 0) + (t.garrison || 0);
    }
    for (const mv of movements) {
      if (!mv?.ownerId) continue;
      map[mv.ownerId] = (map[mv.ownerId] || 0) + (mv.troops || 0);
    }
    return map;
  }, [territories, movements]);

  const ourTotalArmy = playerSideIds.reduce(
    (sum, id) => sum + (armyByNation[id] || 0),
    0
  );
  const enemyTotalArmy = enemySideIds.reduce(
    (sum, id) => sum + (armyByNation[id] || 0),
    0
  );
  const combinedArmy = Math.max(1, ourTotalArmy + enemyTotalArmy);
  const ourPowerPct = Math.max(
    8,
    Math.min(92, Math.round((ourTotalArmy / combinedArmy) * 100))
  );

  const ourCasualties = isPlayerAttackerSide
    ? war.casualtiesAttacker
    : war.casualtiesDefender;
  const enemyCasualties = isPlayerAttackerSide
    ? war.casualtiesDefender
    : war.casualtiesAttacker;

  // Allies eligible to be called into this war
  const callableAllies = useMemo(() => {
    const list: Nation[] = [];
    for (const nat of Object.values(nations)) {
      if (
        !nat ||
        nat.isEliminated ||
        nat.id === playerNationId ||
        playerSideIds.includes(nat.id) ||
        enemySideIds.includes(nat.id)
      ) {
        continue;
      }
      const rel = getOrCreateRelation(relations, playerNationId, nat.id);
      const isAllyOrPact =
        rel.isAllied ||
        Boolean(rel.allianceType) ||
        nat.vassalOf === playerNationId;
      if (!isAllyOrPact) continue;

      const relWithEnemy = getOrCreateRelation(relations, nat.id, enemyNationId);
      if (relWithEnemy.truceUntilTick > tick && nat.vassalOf !== playerNationId) {
        continue;
      }
      list.push(nat);
    }
    return list;
  }, [
    nations,
    playerNationId,
    playerSideIds,
    enemySideIds,
    relations,
    enemyNationId,
    tick,
  ]);

  // Enrich claimable enemy provinces with development score & war score point cost
  const provinceEntries = useMemo(() => {
    return claimableEnemyProvinces
      .map((terr) => {
        const isOccupiedByUs =
          playerSideIds.includes(terr.ownerId) && Boolean(terr.isOccupied);
        const dev = calculateProvinceDevelopment(terr, enemyNation);
        const pointCost = calculateProvincePeaceScoreCost(
          terr,
          enemyNation,
          isOccupiedByUs
        );
        return {
          territory: terr,
          isOccupiedByUs,
          devScore: dev.developmentScore,
          pointCost,
        };
      })
      .sort((a, b) => {
        if (a.isOccupiedByUs !== b.isOccupiedByUs) {
          return a.isOccupiedByUs ? -1 : 1;
        }
        return a.pointCost - b.pointCost;
      });
  }, [claimableEnemyProvinces, playerSideIds, enemyNation]);

  const validSelectedIds = useMemo(() => {
    const validSet = new Set(provinceEntries.map((p) => p.territory.id));
    return selectedTerritoryIds.filter((id) => validSet.has(id));
  }, [selectedTerritoryIds, provinceEntries]);

  const isFullAnnexSelected =
    provinceEntries.length > 0 &&
    validSelectedIds.length === provinceEntries.length;

  const rawTerritoryCost = useMemo(() => {
    const selSet = new Set(validSelectedIds);
    let sum = 0;
    for (const item of provinceEntries) {
      if (selSet.has(item.territory.id)) {
        sum += item.pointCost;
      }
    }
    if (isFullAnnexSelected && sum > 100) {
      return 100;
    }
    return sum;
  }, [validSelectedIds, provinceEntries, isFullAnnexSelected]);

  const remainingProvincesCount = Math.max(
    0,
    provinceEntries.length - validSelectedIds.length
  );
  const vassalCost =
    demandVassal && remainingProvincesCount > 0
      ? remainingProvincesCount <= 3
        ? 35
        : 45
      : 0;
  const tributeCost = demandTribute ? 20 : 0;
  const reparationsCost = demandReparations ? 15 : 0;
  const totalSpentPoints =
    rawTerritoryCost + vassalCost + tributeCost + reparationsCost;

  const isOverBudget = totalSpentPoints > availableBudget;
  const canSignDemands = totalSpentPoints > 0 && !isOverBudget;

  const toggleProvinceDemand = (territoryId: string) => {
    sound.playClick();
    setSelectedTerritoryIds((prev) =>
      prev.includes(territoryId)
        ? prev.filter((id) => id !== territoryId)
        : [...prev, territoryId]
    );
  };

  const selectAllOccupied = () => {
    sound.playClick();
    setSelectedTerritoryIds(
      provinceEntries.filter((p) => p.isOccupiedByUs).map((p) => p.territory.id)
    );
  };

  const selectFullAnnexation = () => {
    sound.playClick();
    setSelectedTerritoryIds(provinceEntries.map((p) => p.territory.id));
    setDemandVassal(false);
  };

  if (!playerNation || !enemyNation) return null;

  const displayScore =
    signedWarScore >= 0
      ? Math.max(signedWarScore, availableBudget)
      : signedWarScore;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/82 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-war-modal-title"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#14110e] border border-[#caa15a]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f3ead7]"
      >
        {/* Top Header + Active War Switcher */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[#221a14] via-[#2c1f16] to-[#1a1511] border-b border-[#caa15a]/35 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/45 border border-[#caa15a]/35">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={26}
                height={18}
              />
              <span className="text-xs font-bold text-amber-400">⚔</span>
              <NationFlagCanvasBadge
                nationId={enemyNation.id}
                flagCode={enemyNation.flagCode}
                color={enemyNation.color}
                width={26}
                height={18}
              />
            </div>
            <div className="min-w-0">
              <h2
                id="unified-war-modal-title"
                className="font-display font-bold text-sm sm:text-base text-amber-100 truncate"
              >
                {war.name.replace(/\s*\((1440|2026)\)\s*/g, '')}
              </h2>
              <p className="text-[11px] text-[#c5b79e]">
                Tek Merkezli Savaş Masası & Savaş Puanı Bütçeli Barış Konferansı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {playerWars.length > 1 && (
              <select
                value={war.id}
                onChange={(e) => {
                  sound.playClick();
                  onSelectWar(e.target.value);
                }}
                aria-label="Aktif savaş seç"
                className="px-2.5 py-1.5 rounded-xl bg-black/50 border border-[#caa15a]/40 text-xs font-bold text-amber-200"
              >
                {playerWars.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Savaş masasını kapat"
              className="w-8 h-8 rounded-xl bg-black/45 hover:bg-black/70 border border-[#caa15a]/30 flex items-center justify-center text-[#d8cbb5] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Power Balance & War Score Strip */}
        <div className="px-4 py-2.5 bg-[#1b1612] border-b border-[#caa15a]/25 space-y-1.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-emerald-300">
              🛡️ Bizim Cephe: {(ourTotalArmy / 1000).toFixed(1)}B Asker · Kayıp:{' '}
              {(ourCasualties / 1000).toFixed(1)}B
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg font-mono-num font-extrabold text-xs border ${
                displayScore >= 20
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                  : displayScore > 0
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : displayScore <= -20
                  ? 'bg-rose-950/90 border-rose-500/60 text-rose-300'
                  : displayScore < 0
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              }`}
            >
              Savaş Skoru: {displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`} · İşgalimiz:{' '}
              {occupiedEnemyProvinces.length}/{claimableEnemyProvinces.length} Şehir
            </span>
            <span className="font-bold text-rose-300">
              ⚔️ Karşı Cephe: {(enemyTotalArmy / 1000).toFixed(1)}B Asker · Kayıp:{' '}
              {(enemyCasualties / 1000).toFixed(1)}B
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-rose-900/80 overflow-hidden flex border border-black/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
              style={{ width: `${ourPowerPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-red-700 transition-all duration-300"
              style={{ width: `${100 - ourPowerPct}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content: Coalitions, Call Allies, and Point-Budget Peace Conference */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs">
          {/* 1. War Coalitions & Call Ally Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Our Coalition + Call Ally */}
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/35 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bizim Cephe & Müttefikler ({playerSideIds.length})</span>
                </span>
                <span className="text-[11px] font-mono-num text-emerald-200">
                  Güç Oranı: %{ourPowerPct}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {playerSideIds.map((nId) => {
                  const nat = nations[nId];
                  if (!nat) return null;
                  return (
                    <div
                      key={nId}
                      className="px-2 py-1 rounded-lg bg-black/45 border border-emerald-500/30 flex items-center gap-1.5"
                    >
                      <NationFlagCanvasBadge
                        nationId={nat.id}
                        flagCode={nat.flagCode}
                        color={nat.color}
                        width={18}
                        height={12}
                      />
                      <span className="font-bold text-white text-[11px]">
                        {nat.name.replace(/\s*\((1440|2026)\)\s*$/, '')}
                      </span>
                      <span className="text-[10px] font-mono-num text-emerald-300">
                        {((armyByNation[nId] || 0) / 1000).toFixed(1)}B
                      </span>
                    </div>
                  );
                })}
              </div>

              {callableAllies.length > 0 && (
                <div className="pt-1.5 border-t border-emerald-500/20 space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Savaşa Çağrılabilir Müttefikler ({callableAllies.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {callableAllies.map((ally) => (
                      <button
                        key={ally.id}
                        type="button"
                        onClick={() => onCallAllyToWar(war.id, ally.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <NationFlagCanvasBadge
                          nationId={ally.id}
                          flagCode={ally.flagCode}
                          color={ally.color}
                          width={16}
                          height={11}
                        />
                        <span>📣 {ally.name.replace(/\s*\((1440|2026)\)\s*$/, '')} Çağır</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Enemy Coalition */}
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/35 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Karşı Cephe & Müttefikleri ({enemySideIds.length})</span>
                </span>
                <span className="text-[11px] font-mono-num text-rose-200">
                  Güç Oranı: %{100 - ourPowerPct}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {enemySideIds.map((nId) => {
                  const nat = nations[nId];
                  if (!nat) return null;
                  return (
                    <div
                      key={nId}
                      className="px-2 py-1 rounded-lg bg-black/45 border border-rose-500/30 flex items-center gap-1.5"
                    >
                      <NationFlagCanvasBadge
                        nationId={nat.id}
                        flagCode={nat.flagCode}
                        color={nat.color}
                        width={18}
                        height={12}
                      />
                      <span className="font-bold text-white text-[11px]">
                        {nat.name.replace(/\s*\((1440|2026)\)\s*$/, '')}
                      </span>
                      <span className="text-[10px] font-mono-num text-rose-300">
                        {((armyByNation[nId] || 0) / 1000).toFixed(1)}B
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Point-Budget Peace Conference Builder */}
          <div className="p-3.5 rounded-2xl bg-[#1c1713] border border-[#caa15a]/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-amber-200 flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-amber-400" />
                  <span>Savaş Puanı Bütçeli Barış Konferansı</span>
                </h3>
                <p className="text-[11px] text-[#c5b79e]">
                  Savaşta kazandığınız puan bütçesi kadar şehir talep edebilir, komple ilhak, vasal veya haraç şartlarını birleştirebilirsiniz.
                </p>
              </div>

              {/* Spent / Available War Score Budget Pill */}
              <div
                className={`px-3 py-1.5 rounded-xl border font-mono-num font-bold text-xs flex items-center gap-2 ${
                  isOverBudget
                    ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                    : totalSpentPoints > 0
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                    : 'bg-black/50 border-[#caa15a]/40 text-amber-200'
                }`}
              >
                <span>
                  Harcanan Puan: <strong>{totalSpentPoints}</strong> / Kazanılan Bütçe:{' '}
                  <strong>{availableBudget}</strong>
                </span>
              </div>
            </div>

            {/* Live Acceptance Status Banner (+25 War Score Requirement) */}
            <div
              className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                displayScore < 25
                  ? 'bg-amber-950/65 border-amber-500/60 text-amber-200'
                  : isOverBudget
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  : totalSpentPoints > 0
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                  : 'bg-black/35 border-[#caa15a]/25 text-[#d8cbb5]'
              }`}
            >
              <div className="flex items-center gap-2">
                {displayScore < 25 || isOverBudget ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>
                  {displayScore < 25
                    ? `🔒 Savaş ilan edildikten hemen sonra barış yapılamaz! Barış antlaşması imzalayabilmek için Savaş Skorunda en az +25% önde olmalısınız (Mevcut: ${displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`}).`
                    : isOverBudget
                    ? `Puan Bütçesi Aşıldı (+${totalSpentPoints - availableBudget} Puan fazla). Daha fazla şehir işgal edin veya talepleri azaltın.`
                    : totalSpentPoints > 0
                    ? `${enemyNation.name} seçilen barış şartlarını (${totalSpentPoints} Puan) kabul ediyor!`
                    : 'Aşağıdan talep edeceğiniz şehirleri veya antlaşma şartlarını seçin.'}
                </span>
              </div>
            </div>

            {/* Territory Demand Section with Quick Buttons (Select Occupied / Full Annexation / Clear) */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-amber-100">
                  📍 Şehir & Toprak Talepleri ({validSelectedIds.length}/{provinceEntries.length} Şehir Seçili · {rawTerritoryCost} Puan)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllOccupied}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold cursor-pointer"
                  >
                    ⚡ İşgal Edilenleri Seç ({occupiedEnemyProvinces.length})
                  </button>
                  <button
                    type="button"
                    onClick={selectFullAnnexation}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      isFullAnnexSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    🏴 Komple İlhak Et (Tüm Şehirler)
                  </button>
                  {validSelectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSelectedTerritoryIds([]);
                      }}
                      className="px-2 py-1 rounded-lg bg-black/50 hover:bg-black/70 border border-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1 rounded-xl bg-black/35 border border-[#caa15a]/20">
                {provinceEntries.map(({ territory, isOccupiedByUs, devScore, pointCost }) => {
                  const isSelected = validSelectedIds.includes(territory.id);
                  return (
                    <button
                      key={territory.id}
                      type="button"
                      onClick={() => toggleProvinceDemand(territory.id)}
                      className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/25 border-amber-400 text-amber-100 shadow'
                          : isOccupiedByUs
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-100 hover:border-emerald-400'
                          : 'bg-black/45 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[11px] truncate">
                          {territory.name.replace(/^★\s*/, '')}
                        </div>
                        <div className="text-[10px] text-[#c5b79e] flex items-center gap-1">
                          <span>★{devScore}</span>
                          {isOccupiedByUs && (
                            <span className="text-emerald-400 font-semibold">· İşgalde</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-extrabold shrink-0 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-black/60 text-amber-300 border border-[#caa15a]/30'
                        }`}
                      >
                        {pointCost}P
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strategic Treaty Clauses (Vassalize / Tribute / Reparations) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={isFullAnnexSelected}
                onClick={() => {
                  sound.playClick();
                  setDemandVassal((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  demandVassal && !isFullAnnexSelected
                    ? 'bg-purple-950/60 border-purple-400 text-purple-100'
                    : 'bg-black/40 border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    <span>Vasal Yap</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Kalan topraklarıyla bağlı devlet olur
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/25 border border-purple-400/40 font-mono-num font-bold text-[11px] text-purple-200 shrink-0">
                  {remainingProvincesCount <= 3 ? '35P' : '45P'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setDemandTribute((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  demandTribute
                    ? 'bg-amber-950/60 border-amber-400 text-amber-100'
                    : 'bg-black/40 border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>Haraca Bağla</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Düzenli haraç ve gelir payı öder
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/40 font-mono-num font-bold text-[11px] text-amber-200 shrink-0">
                  20P
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setDemandReparations((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  demandReparations
                    ? 'bg-emerald-950/60 border-emerald-400 text-emerald-100'
                    : 'bg-black/40 border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Savaş Tazminatı</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Hazineden nakit altın tazminatı
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 font-mono-num font-bold text-[11px] text-emerald-200 shrink-0">
                  15P
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Unified Action Bar: Peace Demand / White Peace / Surrender */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#1a1511] border-t border-[#caa15a]/35 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSignDemands || displayScore < 25}
              title={
                displayScore < 25
                  ? `Barış antlaşması için en az +25% Savaş Skoru gereklidir (Mevcut: ${displayScore}%)`
                  : undefined
              }
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'PEACE_DEMANDS',
                  demandedTerritoryIds: validSelectedIds,
                  demandVassal: demandVassal && !isFullAnnexSelected,
                  demandTribute,
                  demandReparations,
                })
              }
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Handshake className="w-4 h-4" />
              <span>
                {displayScore < 25
                  ? `🔒 Barış İmzala (+25% Skor Şartı)`
                  : `📜 Barış Talebini İmzala (${totalSpentPoints}/${availableBudget} Puan)`}
              </span>
            </button>

            <button
              type="button"
              disabled={displayScore < 25}
              title={
                displayScore < 25
                  ? `Beyaz barış için en az +25% Savaş Skoru gereklidir (Mevcut: ${displayScore}%)`
                  : undefined
              }
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'WHITE_PEACE',
                })
              }
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed border border-slate-600 text-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {displayScore < 25
                  ? '🔒 Galipsiz Barış (+25% Şart)'
                  : '🕊️ Galipsiz Barış (Beyaz Barış)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'SURRENDER',
                })
              }
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🏳️ Teslim Ol</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-black/50 hover:bg-black/70 border border-[#caa15a]/30 text-[#d8cbb5] font-semibold text-xs cursor-pointer"
          >
            Haritaya Dön
          </button>
        </div>
      </div>
    </div>
  );
};

