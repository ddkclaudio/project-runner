import { create } from 'zustand';

export type AppProgressKind = 'install' | 'launch' | 'deepseek';

export type AppProgress = {
  percent: number;
  phase: string;
  kind: AppProgressKind;
};

type AppProgressState = {
  byId: Record<string, AppProgress>;
  setProgress: (id: string, progress: AppProgress) => void;
  clearProgress: (id: string) => void;
  getProgress: (id: string) => AppProgress | undefined;
  isBusy: (id: string) => boolean;
};

export const useAppProgressStore = create<AppProgressState>((set, get) => ({
  byId: {},

  setProgress: (id, progress) =>
    set((state) => ({
      byId: { ...state.byId, [id]: progress },
    })),

  clearProgress: (id) =>
    set((state) => {
      if (!(id in state.byId)) return state;
      const next = { ...state.byId };
      delete next[id];
      return { byId: next };
    }),

  getProgress: (id) => get().byId[id],

  isBusy: (id) => Boolean(get().byId[id]),
}));
