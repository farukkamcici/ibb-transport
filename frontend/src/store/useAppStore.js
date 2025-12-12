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
      selectedDirection: 'G',
      showRoute: false,
      metroSelection: {
        lineCode: null,
        stationId: null,
        directionId: null,
      },
      
      setSelectedLine: (line) => set({ 
        selectedLine: line, 
        isPanelOpen: true,
        selectedHour: new Date().getHours() // Panel açıldığında şu anki saate ayarla
      }),
      closePanel: () => set({ 
        isPanelOpen: false, 
        selectedLine: null, 
        showRoute: false,
        selectedHour: new Date().getHours() // Panel kapandığında resetle
      }),
      setSelectedHour: (hour) => set({ selectedHour: hour }),
      setUserLocation: (location) => set({ userLocation: location }),
      setAlertMessage: (message) => set({ alertMessage: message }),
      setSelectedDirection: (direction) => set({ selectedDirection: direction }),
      setShowRoute: (show) => set({ showRoute: show }),
      setMetroSelection: (lineCode, stationId, directionId) => set({
        metroSelection: {
          lineCode,
          stationId,
          directionId,
        }
      }),
      resetMetroSelection: () => set({
        metroSelection: {
          lineCode: null,
          stationId: null,
          directionId: null,
        }
      }),
      
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
