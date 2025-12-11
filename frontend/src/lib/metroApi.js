/**
 * Metro Istanbul API Client
 * 
 * Provides typed API functions for metro-specific endpoints.
 * Separate from main api.js to keep metro logic isolated.
 */

import axios from 'axios';

const metroClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://ibb-transport.onthewifi.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

const stationsCache = new Map();
const stationsPromiseCache = new Map();

// Add retry logic
metroClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest._retry && error.code === 'ECONNABORTED') {
      originalRequest._retry = true;
      return metroClient(originalRequest);
    }

    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return metroClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

/**
 * @typedef {object} MetroStation
 * @property {number} id - Station ID
 * @property {string} name - Station name (uppercase)
 * @property {string} description - Localized station name
 * @property {number} order - Station sequence on line
 * @property {object} coordinates - {lat: number, lng: number}
 * @property {object} accessibility - Accessibility features
 * @property {Array<{id: number, name: string}>} directions - Available directions
 */

/**
 * @typedef {object} MetroLine
 * @property {number} id - Line ID
 * @property {string} name - Line code (M1A, M2, etc.)
 * @property {string} description - Line description (Turkish)
 * @property {string} description_en - Line description (English)
 * @property {string} color - Hex color code
 * @property {string} first_time - First departure time
 * @property {string} last_time - Last departure time
 * @property {boolean} is_active - Operational status
 * @property {MetroStation[]} stations - Stations on this line
 */

/**
 * @typedef {object} MetroTopology
 * @property {Object.<string, MetroLine>} lines - Lines keyed by code
 * @property {object} metadata - Topology metadata
 */

/**
 * @typedef {object} TrainArrival
 * @property {string} TrainId - Train identifier
 * @property {string} DestinationStationName - Final destination
 * @property {number} RemainingMinutes - Minutes until arrival
 * @property {string} ArrivalTime - Formatted arrival time
 * @property {boolean} IsCrowded - Crowding indicator
 */

/**
 * Get complete metro network topology.
 * Cached at backend startup, instant response.
 * 
 * @returns {Promise<MetroTopology>}
 */
export const getMetroTopology = async () => {
  try {
    const response = await metroClient.get('/metro/topology');
    return response.data;
  } catch (error) {
    console.error('Error fetching metro topology:', error);
    throw new Error('Failed to load metro network data');
  }
};

/**
 * Get specific metro line data.
 * 
 * @param {string} lineCode - Line code (e.g., "M1A", "F1")
 * @returns {Promise<MetroLine>}
 */
export const getMetroLine = async (lineCode) => {
  if (!lineCode) {
    throw new Error('Line code is required');
  }

  try {
    const response = await metroClient.get(`/metro/lines/${lineCode}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching metro line ${lineCode}:`, error);
    throw new Error(`Failed to load metro line ${lineCode}`);
  }
};

/**
 * Get ordered stations for a metro line (live data from Metro Istanbul).
 * Includes accessibility flags and direction metadata.
 *
 * @param {string} lineCode - Line code (e.g., "M1A")
 * @returns {Promise<{line_code: string, line_id: number, stations: MetroStation[]}>}
 */
export const getMetroStations = async (lineCode) => {
  if (!lineCode) {
    throw new Error('Line code is required');
  }

  if (stationsCache.has(lineCode)) {
    return stationsCache.get(lineCode);
  }

  if (stationsPromiseCache.has(lineCode)) {
    return stationsPromiseCache.get(lineCode);
  }

  const requestPromise = metroClient
    .get(`/metro/lines/${lineCode}/stations`)
    .then((response) => {
      stationsCache.set(lineCode, response.data);
      stationsPromiseCache.delete(lineCode);
      return response.data;
    })
    .catch((error) => {
      stationsPromiseCache.delete(lineCode);
      console.error(`Error fetching metro stations for ${lineCode}:`, error);
      throw new Error('Failed to load metro stations');
    });

  stationsPromiseCache.set(lineCode, requestPromise);
  return requestPromise;
};

/**
 * Get line coordinates for map polyline.
 * 
 * @param {string} lineCode - Line code
 * @returns {Promise<{line_code: string, coordinates: number[][]}>}
 */
export const getMetroLineCoordinates = async (lineCode) => {
  if (!lineCode) {
    throw new Error('Line code is required');
  }

  try {
    const response = await metroClient.get(`/metro/lines/${lineCode}/coordinates`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching coordinates for ${lineCode}:`, error);
    throw new Error(`Failed to load line coordinates`);
  }
};

/**
 * Search for metro stations by name.
 * 
 * @param {string} query - Search query (min 2 chars)
 * @returns {Promise<{query: string, results: Array, count: number}>}
 */
export const searchMetroStations = async (query) => {
  if (!query || query.length < 2) {
    return { query: '', results: [], count: 0 };
  }

  try {
    const response = await metroClient.get(`/metro/stations/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Error searching metro stations:', error);
    return { query, results: [], count: 0 };
  }
};

/**
 * Get live train arrivals for a station.
 * Cached 60 seconds at backend.
 * 
 * @param {number} stationId - Station ID
 * @param {number} directionId - Direction ID
 * @param {Date} [dateTime] - Query timestamp (defaults to now)
 * @returns {Promise<{Success: boolean, Data: TrainArrival[]}>}
 */
export const getMetroSchedule = async (stationId, directionId, dateTime = new Date()) => {
  if (!stationId || !directionId) {
    throw new Error('Station ID and Direction ID are required');
  }

  try {
    const response = await metroClient.post('/metro/schedule', {
      BoardingStationId: stationId,
      DirectionId: directionId,
      DateTime: dateTime.toISOString()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching metro schedule:', error);
    throw new Error('Failed to fetch train arrivals');
  }
};

/**
 * Get travel duration between stations.
 * Cached 24 hours at backend.
 * 
 * @param {number} stationId - Starting station ID
 * @param {number} directionId - Direction ID
 * @returns {Promise<{Success: boolean, Data: Array}>}
 */
export const getMetroTravelDuration = async (stationId, directionId) => {
  if (!stationId || !directionId) {
    throw new Error('Station ID and Direction ID are required');
  }

  try {
    const response = await metroClient.post('/metro/duration', {
      BoardingStationId: stationId,
      DirectionId: directionId,
      DateTime: new Date().toISOString()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching metro travel duration:', error);
    throw new Error('Failed to fetch travel times');
  }
};

export default metroClient;
