/** Player performance evaluation API calls. Payloads/responses are camelCase (see apiClient). */
import { apiClient } from './apiClient';

/** Staff (admin/head_coach/coach) — list evaluations for a player, scoped server-side by role. */
export function getPlayerPerformance(playerId) {
  return apiClient.get(`/player-performance/player/${playerId}`);
}

/** Client/parent — list visible evaluations for their own player. */
export function getClientPlayerPerformance(playerId) {
  return apiClient.get(`/client/player-performance/player/${playerId}`);
}

export function getPerformanceRecord(id) {
  return apiClient.get(`/player-performance/${id}`);
}

export function createPerformanceRecord(payload) {
  return apiClient.post('/player-performance', payload);
}

export function updatePerformanceRecord(id, payload) {
  return apiClient.put(`/player-performance/${id}`, payload);
}

export function deletePerformanceRecord(id) {
  return apiClient.delete(`/player-performance/${id}`);
}
