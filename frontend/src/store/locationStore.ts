import { create } from "zustand";

export interface MemberLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  displayName: string;
  avatarUrl?: string;
  timestamp: string;
}

interface LocationState {
  locations: Map<string, MemberLocation>;
  setLocation: (userId: string, data: MemberLocation) => void;
  setLocations: (entries: Array<{ userId: string } & MemberLocation>) => void;
  clearLocations: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: new Map(),

  setLocation: (userId, data) =>
    set((state) => {
      const next = new Map(state.locations);
      next.set(userId, data);
      return { locations: next };
    }),

  setLocations: (entries) =>
    set(() => {
      const next = new Map<string, MemberLocation>();
      for (const { userId, ...rest } of entries) {
        next.set(userId, rest);
      }
      return { locations: next };
    }),

  clearLocations: () => set({ locations: new Map() }),
}));
