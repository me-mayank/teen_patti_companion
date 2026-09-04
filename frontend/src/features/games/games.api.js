import axiosClient from '../../shared/api/axiosClient';

export const createGame = async (gameData) => {
  const response = await axiosClient.post('/games', gameData);
  return response.data;
};

export const getActiveGames = async () => {
  const response = await axiosClient.get('/games');
  return response.data;
};

export const getGameHistory = async () => {
  const response = await axiosClient.get('/games/history');
  return response.data;
};

export const getGameById = async (id) => {
  const response = await axiosClient.get(`/games/${id}`);
  return response.data;
};

export const getCurrentRound = async (id) => {
  try {
    const response = await axiosClient.get(`/games/${id}/rounds/current`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};

export const finalizePlayers = async (id) => {
  const response = await axiosClient.patch(`/games/${id}/finalize-players`);
  return response.data;
};

export const setTurnOrder = async (id, orderedUserIds) => {
  const response = await axiosClient.patch(`/games/${id}/turn-order`, { orderedUserIds });
  return response.data;
};

export const startGame = async (id) => {
  const response = await axiosClient.patch(`/games/${id}/start`);
  return response.data;
};

export const endGame = async (id) => {
  const response = await axiosClient.patch(`/games/${id}/end`);
  return response.data;
};

export const getGameSummary = async (id) => {
  const response = await axiosClient.get(`/games/${id}/summary`);
  return response.data;
};

export const getGameTransactions = async (id) => {
  const response = await axiosClient.get(`/games/${id}/transactions`);
  return response.data;
};

// Phase 4 — Cloud snapshot for hybrid architecture
// Called async in the background by useHybridGame after every N actions
export const postSnapshot = async (id, snapshotData) => {
  const response = await axiosClient.post(`/games/${id}/snapshot`, snapshotData);
  return response.data;
};

// Phase 4 — Hybrid final settlement
export const settleGame = async (id, finalEngineState) => {
  const response = await axiosClient.post(`/games/${id}/settle`, { finalEngineState });
  return response.data;
};

export const getSettlementPreview = async (id) => {
  const response = await axiosClient.get(`/games/${id}/settlement-preview`);
  return response.data;
};
