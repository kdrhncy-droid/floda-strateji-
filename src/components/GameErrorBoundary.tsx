import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : 'Bilinmeyen çalışma zamanı hatası',
    };
  }

  handleRecover = () => {
    try {
      const st = useGameStore.getState();
      st.setSpeed(0);
      st.setActiveTab('NONE');
      st.setPendingWarMove(null);
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMsg: '' });
  };

  handleResetToMenu = () => {
    try {
      const st = useGameStore.getState();
      st.setSpeed(0);
      st.startNewGame();
      st.setScreenState('TITLE_MENU');
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMsg: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Oyun Oturumu Koruma Kalkanı
                </h2>
                <p className="text-xs text-slate-400">
                  Sefer sırasında beklenmeyen bir veri uyuşmazlığı yakalandı ve otomatik duraklatıldı.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-rose-300 break-words">
              {this.state.errorMsg}
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Seferi Onar ve Devam Et
              </button>
              <button
                onClick={this.handleResetToMenu}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Ana Menüye Dön
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
