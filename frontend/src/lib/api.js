import axios from 'axios';
import { format } from 'date-fns';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  try {
    const dateString = format(date, 'yyyy-MM-dd');
    const response = await apiClient.get(`/forecast/${lineName}?target_date=${dateString}`);
    return response.data;
  } catch (error) {
    console.error('Error getting forecast:', error);
    throw error;
  }
};
