import axios from 'axios';
import { format } from 'date-fns';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://ibb-transport.onthewifi.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let requestInterceptor = null;
let responseInterceptor = null;

requestInterceptor = apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

responseInterceptor = apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest._retry && error.code === 'ECONNABORTED') {
      originalRequest._retry = true;
      return apiClient(originalRequest);
    }

    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

/**
 * @typedef {object} TransportLine
 * @property {string} line_name
 * @property {number} transport_type_id
 * @property {string} road_type
 * @property {string} line
 */

/**
 * @typedef {object} HourlyForecast
 * @property {number} hour
 * @property {number} predicted_value
 * @property {number} occupancy_pct
 * @property {string} crowd_level
 * @property {number} max_capacity
 */

/**
 * @typedef {object} SearchResult
 * @property {string} line_name
 * @property {number} transport_type_id
 * @property {string} road_type
 * @property {string} line
 * @property {number} relevance_score
 */

/**
 * Searches for transport lines with metadata.
 * @param {string} query
 * @returns {Promise<SearchResult[]>}
 */
export const searchLines = async (query) => {
  if (!query) {
    return [];
  }
  try {
    const response = await apiClient.get(`/lines/search?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Error searching lines:', error);
    return [];
  }
};

/**
 * Gets the pre-calculated 24-hour forecast for a given line and date.
 * @param {string} lineName
 * @param {Date} date
 * @param {string} [direction] - Optional direction ('G' or 'D') for direction-specific service hours
 * @returns {Promise<HourlyForecast[]>}
 */
export const getForecast = async (lineName, date, direction = null) => {
  if (!lineName) {
    throw new Error('Line name is required');
  }

  try {
    const dateString = format(date, 'yyyy-MM-dd');
    const params = { target_date: dateString };
    if (direction) {
      params.direction = direction;
    }
    
    const response = await apiClient.get(`/forecast/${encodeURIComponent(lineName)}`, { params });
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format');
    }

    if (response.data.length !== 24) {
      console.warn(`Incomplete forecast data: ${response.data.length}/24 hours`);
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || 'Unknown error';

      if (status === 404) {
        if (detail.includes('not found')) {
          throw new Error(`Line '${lineName}' not found`);
        } else {
          throw new Error(`No forecast available for ${lineName}`);
        }
      } else if (status === 400) {
        throw new Error(detail);
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(`Error: ${detail}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw error;
    }
  }
};

/**
 * Gets transport line metadata.
 * @param {string} lineName
 * @returns {Promise<TransportLine>}
 */
export const getLineMetadata = async (lineName) => {
  try {
    const response = await apiClient.get(`/lines/${encodeURIComponent(lineName)}`);
    return response.data;
  } catch (error) {
    console.error('Error getting line metadata:', error);
    return null;
  }
};

/**
 * Gets line operational status (alerts + operation hours).
 * @param {string} lineCode
 * @param {string} [direction] - Optional direction ('G' or 'D') for direction-specific operation hours
 * @returns {Promise<{status: string, alerts: Array<{text: string, time: string, type: string}>, next_service_time: string|null}>}
 */
export const getLineStatus = async (lineCode, direction = null) => {
  try {
    const params = direction ? { direction } : {};
    const response = await apiClient.get(`/lines/${encodeURIComponent(lineCode)}/status`, { params });
    return response.data;
  } catch (error) {
    console.error('Error getting line status:', error);
    return { status: 'ACTIVE', alerts: [], next_service_time: null };
  }
};

export const getCapacityMeta = async (lineCode) => {
  if (!lineCode) {
    throw new Error('Line code is required');
  }

  const response = await apiClient.get(`/capacity/${encodeURIComponent(lineCode)}`);
  return response.data;
};

export const getCapacityMix = async (lineCode, topK = 10) => {
  if (!lineCode) {
    throw new Error('Line code is required');
  }

  const response = await apiClient.get(`/capacity/${encodeURIComponent(lineCode)}/mix`, {
    params: { top_k: topK },
  });
  return response.data;
};

export { apiClient };
