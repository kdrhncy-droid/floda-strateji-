import React from "react";
import { Swords, Handshake, Crown, Ban, AlertTriangle, Coins, Shield, ArrowRight, Landmark, ScrollText, Globe } from "lucide-react";
import { ActiveWar, DiplomaticRelation, GameModeId, Nation, Territory } from "../../types/game";
import { DiplomaticActionType, PeaceDealType } from "./drawerTypes";
import {
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
  isNationEmbargoing,
} from "../../engine/simulationEngine";
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from "../../engine/seasonSupplyAndAiProfile";
import {
  calculateProvincePurchasePrice,
  calculateVassalAnnexCost,
  canAcceptLandPurchase,
} from "../../engine/diplomacyAndWarActions";
import { computeNationTechMetrics } from "../../data/world2026Data";
import { sound } from "../../utils/soundEngine";

interface ProvinceForeignDiplomacyPanelProps {
  playerNation: Nation;
  selectedTerritory: Territory;
  selectedOwner: Nation;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  gameMode: string;
  onDiplomaticAction: (targetNationId: string, action: DiplomaticActionType) => void;
  onOfferLandPurchase?: (territoryId: string) => void;
  onIssueProvinceUltimatum?: (territoryId: string) => void;
  onPeaceDeal: (warId: string, dealType: PeaceDealType) => void;
  onSelectTerritory: (territoryId: string) => void;
  onInspectNation?: (nationId: string) => void;
  onOpenWarModal?: (warId: string) => void;
  onSiegeBombardment: (territoryId: string, method: "ARTILLERY" | "DRONE_RAID") => void;
  onClose: () => void;
}

export const ProvinceForeignDiplomacyPanel: React.FC<ProvinceForeignDiplomacyPanelProps> = ({
  playerNation,
  selectedTerritory,
  selectedOwner,
  territories,
  nations,
  relations,
  wars,
  gameMode,
  onDiplomaticAction,
  onOfferLandPurchase,
  onIssueProvinceUltimatum,
  onPeaceDeal,
  onInspectNation,
  onOpenWarModal,
  onSiegeBombardment,
  onClose,
}) => {
  const rel = getOrCreateRelation(relations, playerNation.id, selectedOwner.id);
  const playerEmbargoActive = isNationEmbargoing(rel, playerNation.id);
  const targetEmbargoActive = isNationEmbargoing(rel, selectedOwner.id);
  const activeWar = isAtWar(wars, playerNation.id, selectedOwner.id);
  const playerWarScore = activeWar
    ? getWarScoreForNation(activeWar, playerNation.id)
    : null;
  const ownerPersonality = resolveNationAiPersonality(selectedOwner, territories);
  const personalityMeta = AI_PERSONALITY_META[ownerPersonality];

  const ownerProvs = Object.values(territories).filter(
    (t) => t && t.ownerId === selectedOwner.id
  );
  const ownerProvCount = ownerProvs.length;
  const ownerTotalArmy = ownerProvs.reduce(
    (sum, t) => sum + (t.garrison || 0),
    0
  );
  const ownerTech = computeNationTechMetrics(
    selectedOwner,
    territories,
    (gameMode as GameModeId) || "EMPIRES_1440"
  );

  const bordersPlayer = selectedTerritory.neighbors.some(
    (nId) => territories[nId]?.ownerId === playerNation.id
  );
  const purchasePrice = calculateProvincePurchasePrice(
    selectedTerritory,
    selectedOwner,
    rel.score
  );
  const purchaseCheck = canAcceptLandPurchase({
    territory: selectedTerritory,
    sellerNation: selectedOwner,
    sellerPersonality: ownerPersonality,
    relationScore: rel.score,
    sellerProvCount: ownerProvCount,
  });
  const vassalAnnexCost = calculateVassalAnnexCost(
    selectedOwner.id,
    territories
  );

  // Unified AoH3 button classes
  const btnStandard =
    "min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#1b1510] hover:bg-[#251d15] border border-[#caa15a]/35 text-left flex items-center justify-between transition-colors cursor-pointer";
  const btnActivePact =
    "min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-950/65 hover:bg-emerald-900/70 border border-emerald-500/50 text-left flex items-center justify-between transition-colors cursor-pointer";
  const btnHostile =
    "min-h-[44px] px-3.5 py-2.5 rounded-xl bg-rose-950/55 hover:bg-rose-900/65 border border-rose-500/45 text-left flex items-center justify-between transition-colors cursor-pointer";

  return (
    <div className="bg-[#14100c]/95 border border-[#caa15a]/35 rounded-2xl p-4 space-y-4">
      {/* Castle Siege Bombardment Panel when at War */}
      {activeWar && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-200">
              ♜ {selectedTerritory.name} Kalesi Kuşatma Harekatı
            </span>
            <span className="font-mono-num text-xs font-bold text-amber-300">
              Sur Dayanıklılığı: %{selectedTerritory.castleWallHp ?? 100}
            </span>
          </div>
          <p className="text-[11px] text-[#d8cbb5]">
            {gameMode === "EMPIRES_1440"
              ? "Ordularınız hücuma geçmeden önce kuşatma bataryaları veya lağımcı ocaklarıyla kale surlarını yıkabilirsiniz."
              : "Ordularınız hücuma geçmeden önce topçu bataryaları veya taarruz filolarıyla kale surlarını yıkabilirsiniz."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => onSiegeBombardment(selectedTerritory.id, "ARTILLERY")}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#221a12] hover:bg-[#2c2217] border border-[#caa15a]/45 text-left transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-amber-200">
                {gameMode === "EMPIRES_1440"
                  ? "Darbzen Topçu Ateşi"
                  : "Topçu Bombardımanı"}
              </div>
              <div className="font-mono-num text-[10px] text-amber-400">
                180 Altın · Sur -%35 &amp; Garnizon -%10
              </div>
            </button>
            <button
              onClick={() => onSiegeBombardment(selectedTerritory.id, "DRONE_RAID")}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#221a12] hover:bg-[#2c2217] border border-[#caa15a]/45 text-left transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-[#f3ead7]">
                {gameMode === "EMPIRES_1440"
                  ? "Şahi Topu & Lağımcı Hücumu"
                  : "SİHA & Nokta Kuşatma Baskını"}
              </div>
              <div className="font-mono-num text-[10px] text-amber-300">
                220 Altın · 20 ⚜ Nüfuz · Sur -%45 &amp; Garnizon -%18
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Foreign Nation Header + Complete Intel Strip (Altın, Toplam Ordu, Teknoloji, Başkent) */}
      <div className="space-y-3 border-b border-[#caa15a]/25 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-display font-bold text-[#f3ead7]">
              {selectedOwner.name} İle Diplomatik İlişkiler
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#b8a990] mt-0.5">
              <span>
                İlişki Puanı:{" "}
                <strong
                  className={`font-mono-num ${
                    rel.score >= 25
                      ? "text-emerald-300"
                      : rel.score <= -25
                      ? "text-rose-400"
                      : "text-amber-300"
                  }`}
                >
                  {rel.score > 0 ? `+${rel.score}` : rel.score}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span
                className="text-amber-200 font-semibold"
                title={personalityMeta.description}
                data-testid="foreign-ai-personality"
              >
                {personalityMeta.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onInspectNation && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onInspectNation(selectedOwner.id);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#1b1510] hover:bg-[#251d15] border border-[#caa15a]/40 text-[#f3ead7] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 shrink-0 text-[#e0b86e]" />
                <span>Tüm Diplomasisi</span>
              </button>
            )}

            {activeWar ? (
              <span className="text-xs font-bold text-rose-400">
                SAVAŞTA · Senin tarafın:{" "}
                {playerWarScore !== null && playerWarScore > 0 ? "+" : ""}
                {playerWarScore ?? activeWar.attackerWarScore}%
              </span>
            ) : (
              <span className="text-xs text-[#d8cbb5]">
                {rel.allianceType === "OFFENSIVE"
                  ? "Saldırı Paktı Müttefiki"
                  : rel.allianceType === "DEFENSIVE"
                  ? "Savunma Paktı Ortağı"
                  : rel.isAllied
                  ? "Resmi Müttefik"
                  : rel.hasTradeAgreement
                  ? "Ticaret Ortağı"
                  : targetEmbargoActive
                  ? "Bu ülke sana ambargo uyguluyor"
                  : playerEmbargoActive
                  ? "Sen bu ülkeye ambargo uyguluyorsun"
                  : "Tarafsız İlişki"}
              </span>
            )}
          </div>
        </div>

        {/* 4-Box Foreign Intel Strip: Altın, Asker, Teknoloji, Başkent & Toprak */}
        <div
          data-testid="foreign-nation-intel-strip"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center"
        >
          <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
            <div className="text-[10px] text-[#b8a990]">Hazine (Altın)</div>
            <div className="font-mono-num text-xs sm:text-sm font-bold text-amber-300">
              {Math.floor(selectedOwner.treasury).toLocaleString("tr-TR")} A
            </div>
          </div>
          <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
            <div className="text-[10px] text-[#b8a990]">Toplam Asker</div>
            <div className="font-mono-num text-xs sm:text-sm font-bold text-emerald-300">
              {ownerTotalArmy.toLocaleString("tr-TR")}
            </div>
          </div>
          <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
            <div className="text-[10px] text-[#b8a990]">Teknoloji Düzeyi</div>
            <div className="font-mono-num text-xs sm:text-sm font-bold text-[#f3ead7]">
              Sv.{ownerTech.techLevel.toFixed(2)} / {ownerTech.maxTechLevel.toFixed(1)}
            </div>
          </div>
          <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/25 p-2">
            <div className="text-[10px] text-[#b8a990]">Başkent &amp; Toprak</div>
            <div className="font-mono-num text-xs sm:text-sm font-bold text-[#f3ead7]">
              Bşk.Sv.{ownerTech.capitalLevel} · {ownerProvCount} Eyalet
            </div>
          </div>
        </div>
      </div>

      {/* Diplomatic Action Grid — Unified AoH3 Obsidian / Antique Gold / Emerald / Crimson Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "IMPROVE")}
          className={btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7]">
              Diplomatik Heyet Gönder
            </div>
            <div className="text-[11px] text-emerald-300">
              +20 İlişki Puanı (150 Altın)
            </div>
          </div>
          <Handshake className="w-4 h-4 text-[#e0b86e] shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "INSULT")}
          className={btnHostile}
        >
          <div>
            <div className="text-xs font-bold text-rose-100">
              Diplomatik Nota &amp; Kınama
            </div>
            <div className="text-[11px] text-rose-300">
              -25 İlişki · Savaş Gerekçesi Hazırlar
            </div>
          </div>
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "TRADE")}
          className={rel.hasTradeAgreement ? btnActivePact : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7]">
              {rel.hasTradeAgreement
                ? "Ticaret Anlaşması Aktif"
                : "Ticaret Anlaşması Kur"}
            </div>
            <div className="text-[11px] text-amber-300">
              +%14 Karşılıklı Ticaret Geliri
            </div>
          </div>
          <Coins className="w-4 h-4 text-[#e0b86e] shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "NON_AGGRESSION")}
          className={rel.hasNonAggression ? btnActivePact : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7]">
              {rel.hasNonAggression
                ? "Saldırmazlık Paktı Aktif"
                : "Saldırmazlık Paktı İmzala"}
            </div>
            <div className="text-[11px] text-[#c5b79e]">
              Karşılıklı sınır güvenliği garantisi
            </div>
          </div>
          <Shield className="w-4 h-4 text-[#e0b86e] shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "MILITARY_ACCESS")}
          className={rel.hasMilitaryAccess ? btnActivePact : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7]">
              {rel.hasMilitaryAccess
                ? "Askeri Geçiş İzni Aktif"
                : "Askeri Geçiş İzni Al"}
            </div>
            <div className="text-[11px] text-[#c5b79e]">
              {rel.hasMilitaryAccess
                ? "Lojistik Koridor Açık · İptal için tıkla"
                : "+8 İlişki · Lojistik Koridor"}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#e0b86e] shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "DEFENSIVE_PACT")}
          className={rel.allianceType === "DEFENSIVE" ? btnActivePact : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7] flex items-center gap-1.5">
              <span>
                {rel.allianceType === "DEFENSIVE"
                  ? "Savunma Paktı Aktif"
                  : "Savunma Paktı Kur"}
              </span>
            </div>
            <div className="text-[11px] text-[#c5b79e]">
              {rel.allianceType === "DEFENSIVE"
                ? "Saldırıya uğrandığında savunulur (Feshetmek için tıkla)"
                : "Saldırıya uğrandığında tetiklenir (+25 İlişki)"}
            </div>
          </div>
          <Shield className="w-4 h-4 text-[#e0b86e] shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "OFFENSIVE_PACT")}
          className={rel.allianceType === "OFFENSIVE" ? btnActivePact : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7] flex items-center gap-1.5">
              <span>
                {rel.allianceType === "OFFENSIVE"
                  ? "Saldırı Paktı Aktif"
                  : "Saldırı Paktı Kur"}
              </span>
            </div>
            <div className="text-[11px] text-emerald-300">
              {rel.allianceType === "OFFENSIVE"
                ? "Ortak taarruz & savunma yürürlükte"
                : "Ortak hedefe savaşta birlikte taarruz edilir (+45 İlişki)"}
            </div>
          </div>
          <Swords className="w-4 h-4 text-emerald-300 shrink-0" />
        </button>

        <button
          onClick={() => onDiplomaticAction(selectedOwner.id, "EMBARGO")}
          className={playerEmbargoActive ? btnHostile : btnStandard}
        >
          <div>
            <div className="text-xs font-bold text-[#f3ead7]">
              {playerEmbargoActive
                ? "Ambargoyu Kaldır"
                : "Ticaret Ambargosu Uygula"}
            </div>
            <div className="text-[11px] text-amber-300">
              {playerEmbargoActive
                ? "Hedefin ticaret geliri %18 azalıyor."
                : "Uygularsan hedefin ticaret geliri %18 düşer."}
              {targetEmbargoActive && (
                <span className="ml-1 text-rose-300">
                  (Sana ambargo uyguluyor)
                </span>
              )}
            </div>
          </div>
          <Ban className="w-4 h-4 text-amber-400 shrink-0" />
        </button>

        {selectedOwner.vassalOf === playerNation.id ? (
          <button
            onClick={() => onDiplomaticAction(selectedOwner.id, "ANNEX_VASSAL")}
            className={btnStandard}
          >
            <div>
              <div className="text-xs font-bold text-amber-200">
                Vasal Devleti Barışçıl İlhak Et
              </div>
              <div className="text-[11px] text-amber-300">
                {vassalAnnexCost} Altın · +20 İlişki gerekir
              </div>
            </div>
            <Crown className="w-4 h-4 text-[#e0b86e] shrink-0" />
          </button>
        ) : (
          <button
            onClick={() =>
              onDiplomaticAction(selectedOwner.id, "ULTIMATUM_VASSAL")
            }
            className={btnHostile}
          >
            <div>
              <div className="text-xs font-bold text-rose-100">
                Vasallık Ültimatomu Gönder
              </div>
              <div className="text-[11px] text-rose-200">
                20 DP ·{" "}
                {Number(
                  (1.85 * personalityMeta.ultimatumResistance).toFixed(1)
                )}
                x ordu üstünlüğü ({personalityMeta.shortLabel})
              </div>
            </div>
            <Crown className="w-4 h-4 text-rose-300 shrink-0" />
          </button>
        )}

        {/* Territorial Purchase & Territorial Ultimatum for Bordering Non-War Provinces */}
        {!activeWar && bordersPlayer && onOfferLandPurchase && (
          <button
            type="button"
            data-testid="btn-land-purchase"
            onClick={() => onOfferLandPurchase(selectedTerritory.id)}
            title={purchaseCheck.reason}
            className={btnStandard}
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-bold text-[#f3ead7] truncate">
                Toprak Satın Al ({selectedTerritory.name})
              </div>
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                <span className="font-mono-num text-amber-300">
                  {purchasePrice.toLocaleString("tr-TR")} Altın · 15 DP
                </span>
                <span className="text-[#8e806a]">·</span>
                <span
                  className={
                    purchaseCheck.willAccept
                      ? "text-emerald-300 font-semibold"
                      : "text-rose-300 font-semibold"
                  }
                >
                  {purchaseCheck.willAccept ? "Kabul Eder" : "Reddeder"}
                </span>
              </div>
            </div>
            <Landmark className="w-4 h-4 text-[#e0b86e] shrink-0" />
          </button>
        )}

        {!activeWar && bordersPlayer && onIssueProvinceUltimatum && (
          <button
            type="button"
            data-testid="btn-province-ultimatum"
            onClick={() => onIssueProvinceUltimatum(selectedTerritory.id)}
            className={btnHostile}
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-bold text-rose-100 truncate">
                Toprak Ültimatomu ({selectedTerritory.name})
              </div>
              <div className="text-[11px] text-rose-300">
                25 DP · Ezici orduyla savaşmadan ilhak talep et
              </div>
            </div>
            <ScrollText className="w-4 h-4 text-rose-300 shrink-0" />
          </button>
        )}

        {/* Coalition Tactical Intel Before Declaring War */}
        {!activeWar &&
          (() => {
            const targetDefenders = Object.values(relations)
              .filter(
                (r) =>
                  (r.nationA === selectedOwner.id ||
                    r.nationB === selectedOwner.id) &&
                  (r.allianceType === "DEFENSIVE" ||
                    r.allianceType === "OFFENSIVE" ||
                    (r.isAllied && !r.allianceType))
              )
              .map((r) =>
                r.nationA === selectedOwner.id ? r.nationB : r.nationA
              )
              .filter(
                (id) =>
                  id !== playerNation.id &&
                  id !== selectedOwner.id &&
                  nations[id] &&
                  !nations[id].isEliminated
              );

            const playerAttackers = Object.values(relations)
              .filter(
                (r) =>
                  (r.nationA === playerNation.id ||
                    r.nationB === playerNation.id) &&
                  r.allianceType === "OFFENSIVE"
              )
              .map((r) =>
                r.nationA === playerNation.id ? r.nationB : r.nationA
              )
              .filter(
                (id) =>
                  id !== selectedOwner.id &&
                  nations[id] &&
                  !nations[id].isEliminated
              );

            if (targetDefenders.length === 0 && playerAttackers.length === 0) {
              return null;
            }

            return (
              <div className="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-[#19140f] border border-[#caa15a]/30 text-[11px] space-y-1.5">
                {playerAttackers.length > 0 && (
                  <div className="text-emerald-300 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>
                      <strong>Saldırı Paktı Ortaklarınız:</strong>{" "}
                      {playerAttackers.map((id) => nations[id]?.name).join(", ")}{" "}
                      (Sizinle taarruza katılacak)
                    </span>
                  </div>
                )}
                {targetDefenders.length > 0 && (
                  <div className="text-amber-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>
                      <strong>Hedefin Savunma Paktı:</strong>{" "}
                      {targetDefenders.map((id) => nations[id]?.name).join(", ")}{" "}
                      (Saldırı anında savunmaya katılacak!)
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

        {!activeWar ? (
          <button
            onClick={() => onDiplomaticAction(selectedOwner.id, "DECLARE_WAR")}
            className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 border border-rose-500/60 text-white text-left flex items-center justify-between transition-colors shadow-md cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold">Resmi Savaş İlan Et</div>
              <div className="text-[11px] text-rose-100">
                Sınır eyaletlerine askeri sefer ve kuşatma başlat
              </div>
            </div>
            <Swords className="w-4 h-4 text-white shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => {
              if (onOpenWarModal) {
                onClose();
                onOpenWarModal(activeWar.id);
              } else {
                onPeaceDeal(activeWar.id, "ANNEX_OCCUPIED");
              }
            }}
            className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-left flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold">
                Savaş &amp; Barış Masasını Aç
              </div>
              <div className="text-[11px] text-[#2b2218]">
                Cephe skoru, toprak talebi ve tazminat görüşmesi
              </div>
            </div>
            <Handshake className="w-4 h-4 text-[#14100c] shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};

