import React, { Suspense, lazy, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { CommandDrawersProps } from './drawers/drawerTypes';
import { AoH3GlyphSvg } from './illustrations/AoH3Illustrations';
import { sound } from '../utils/soundEngine';

const ProvinceDrawer = lazy(() =>
  import('./drawers/ProvinceDrawer').then((m) => ({ default: m.ProvinceDrawer }))
);
const EconomyDrawer = lazy(() =>
  import('./drawers/EconomyDrawer').then((m) => ({ default: m.EconomyDrawer }))
);
const ConstructionDrawer = lazy(() =>
  import('./drawers/ConstructionDrawer').then((m) => ({ default: m.ConstructionDrawer }))
);
const DiplomacyDrawer = lazy(() =>
  import('./drawers/DiplomacyDrawer').then((m) => ({ default: m.DiplomacyDrawer }))
);
const GovernmentTechDrawer = lazy(() =>
  import('./drawers/GovernmentTechDrawer').then((m) => ({ default: m.GovernmentTechDrawer }))
);
const MilitaryDrawer = lazy(() =>
  import('./drawers/MilitaryDrawer').then((m) => ({ default: m.MilitaryDrawer }))
);

const DrawerChunkFallback: React.FC = () => (
  <div className="py-10 flex items-center justify-center text-xs font-semibold text-[#c5b79e]">
    Panel hazırlanıyor...
  </div>
);

export type { CommandDrawersProps } from './drawers/drawerTypes';

export const CommandDrawers: React.FC<CommandDrawersProps> = (props) => {
  const { activeTab, onClose, selectedTerritory } = props;
  const [drawerSizeMode, setDrawerSizeMode] = useState<'FULL' | 'COMPACT' | 'MINIMIZED'>('FULL');

  if (activeTab === 'NONE') return null;

  const cycleSizeMode = () => {
    sound.playClick();
    setDrawerSizeMode((prev) =>
      prev === 'FULL' ? 'COMPACT' : prev === 'COMPACT' ? 'MINIMIZED' : 'FULL'
    );
  };

  return (
    <div className="hud-drawer-wrapper fixed inset-x-0 bottom-16 z-40 mx-auto max-w-6xl px-2 sm:px-4 pointer-events-none">
      <div
        className={`hud-drawer-card pointer-events-auto bg-[#14100c]/98 border border-[#caa15a]/45 rounded-t-3xl sm:rounded-2xl shadow-2xl ${
          drawerSizeMode === 'MINIMIZED'
            ? 'max-h-[48px]'
            : drawerSizeMode === 'COMPACT'
            ? 'max-h-[42vh] landscape:max-h-[48vh]'
            : activeTab === 'GOVERNMENT'
            ? 'max-h-[84vh] landscape:max-h-[86vh]'
            : 'max-h-[76vh] landscape:max-h-[78vh]'
        } flex flex-col overflow-hidden transition-all`}
      >
        {/* Top Grab Handle & Header (Unified Obsidian + Antique Gold Frame) */}
        <div className="hud-drawer-header flex items-center justify-between px-3.5 sm:px-5 py-2 sm:py-2.5 border-b border-[#caa15a]/25 bg-[#100d09] shrink-0 gap-2">
          <div className="hud-drawer-header-title flex items-center gap-2 min-w-0">
            {activeTab === 'TERRITORY' && (
              <>
                <AoH3GlyphSvg
                  name={selectedTerritory?.isCapital ? 'star' : 'shield'}
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  {selectedTerritory
                    ? selectedTerritory.name.replace(/^★\s*/, '')
                    : 'Eyalet Komuta Merkezi'}
                </h2>
              </>
            )}
            {activeTab === 'ECONOMY' && (
              <>
                <AoH3GlyphSvg
                  name="gold"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  İmparatorluk Hazinesi, Vergi ve Bütçe
                </h2>
              </>
            )}
            {activeTab === 'DIPLOMACY' && (
              <>
                <AoH3GlyphSvg
                  name="handshake"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  Diplomasi, Koalisyonlar ve Barış Masası
                </h2>
              </>
            )}
            {activeTab === 'GOVERNMENT' && (
              <>
                <AoH3GlyphSvg
                  name="crown"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  İdeoloji, Reformlar ve Teknoloji Ağacı
                </h2>
              </>
            )}
            {activeTab === 'MILITARY' && (
              <>
                <AoH3GlyphSvg
                  name="sword"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  Birlik Ağacı, Ordularım &amp; Güç Sıralaması
                </h2>
              </>
            )}
            {activeTab === 'CONSTRUCTION' && (
              <>
                <AoH3GlyphSvg
                  name="hammer"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e] shrink-0"
                />
                <h2 className="font-display text-xs sm:text-base font-bold text-[#f3ead7] truncate">
                  İnşaat &amp; Yatırım Atölyesi
                </h2>
              </>
            )}
          </div>

          <div className="hud-drawer-header-controls flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cycleSizeMode}
              className="px-2.5 min-h-[34px] sm:min-h-[36px] rounded-xl text-[11px] font-semibold bg-[#1b1510] hover:bg-[#261d14] text-[#e0b86e] border border-[#caa15a]/35 flex items-center gap-1 transition-colors cursor-pointer"
              title="Panel Boyutunu Değiştir (Tam / Yarım / Haritayı Gör)"
            >
              {drawerSizeMode === 'MINIMIZED' ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {drawerSizeMode === 'FULL'
                  ? 'Yarım Panel'
                  : drawerSizeMode === 'COMPACT'
                  ? 'Haritayı Gör'
                  : 'Paneli Aç'}
              </span>
            </button>
            <button
              type="button"
              aria-label="Paneli kapat"
              data-testid="drawer-close-btn"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="min-w-[34px] min-h-[34px] sm:min-w-[36px] sm:min-h-[36px] rounded-xl flex items-center justify-center text-[#b8a990] hover:text-[#faf3e3] hover:bg-[#1e1812] border border-transparent hover:border-[#caa15a]/30 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        {drawerSizeMode !== 'MINIMIZED' && (
          <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-4">
            <Suspense fallback={<DrawerChunkFallback />}>
              {activeTab === 'TERRITORY' && <ProvinceDrawer {...props} />}
              {activeTab === 'ECONOMY' && <EconomyDrawer {...props} />}
              {activeTab === 'CONSTRUCTION' && <ConstructionDrawer {...props} />}
              {activeTab === 'DIPLOMACY' && <DiplomacyDrawer {...props} />}
              {activeTab === 'GOVERNMENT' && <GovernmentTechDrawer {...props} />}
              {activeTab === 'MILITARY' && <MilitaryDrawer {...props} />}
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};
