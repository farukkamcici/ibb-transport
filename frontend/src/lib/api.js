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
 * Searches for transport lines.
 * @param {string} query
 * @returns {Promise<string[]>}
 */
export const searchLines = async (query) => {
  if (!query) {
    return [];
  }
  try {
    const response = await apiClient.get(`/lines/search?query=${query}`);
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
 * @returns {Promise<HourlyForecast[]>}
 */
export const getForecast = async (lineName, date) => {
  if (!lineName) {
    throw new Error('Line name is required');
  }

  try {
    const dateString = format(date, 'yyyy-MM-dd');
    const response = await apiClient.get(`/forecast/${encodeURIComponent(lineName)}?target_date=${dateString}`);
    
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
