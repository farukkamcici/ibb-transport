import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      selectedLine: null,
      isPanelOpen: false,
      selectedHour: new Date().getHours(),
      userLocation: null,
      alertMessage: null,
      favorites: [],
      
      setSelectedLine: (line) => set({ selectedLine: line, isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false, selectedLine: null }),
      setSelectedHour: (hour) => set({ selectedHour: hour }),
      setUserLocation: (location) => set({ userLocation: location }),
      setAlertMessage: (message) => set({ alertMessage: message }),
      
      toggleFavorite: (lineId) => set((state) => {
        const exists = state.favorites.includes(lineId);
        return {
          favorites: exists
            ? state.favorites.filter(id => id !== lineId)
            : [...state.favorites, lineId]
        };
      }),
      
      isFavorite: (lineId) => {
        return get().favorites.includes(lineId);
      },
    }),
    {
      name: 'ibb-transport-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favorites: state.favorites,
      }),
    }
  )
);

export default useAppStore;