import axiosClient from '../../shared/api/axiosClient';

export const startRound = async (gameId) => {
  const response = await axiosClient.post(`/games/${gameId}/rounds`);
  return response.data;
};

export const getRound = async (roundId) => {
  const response = await axiosClient.get(`/rounds/${roundId}`);
  return response.data;
};

export const bet = async (roundId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/bet`);
  return response.data;
};

export const betTwice = async (roundId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/bet-twice`);
  return response.data;
};

export const pack = async (roundId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/pack`);
  return response.data;
};

export const requestSideShow = async (roundId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/side-show/request`);
  return response.data;
};

export const respondSideShow = async (roundId, accept) => {
  const response = await axiosClient.post(`/rounds/${roundId}/side-show/respond`, { accept });
  return response.data;
};

export const submitSideShowResult = async (roundId, loserUserId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/side-show/result`, { loserUserId });
  return response.data;
};

export const requestShow = async (roundId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/show/request`);
  return response.data;
};

export const submitShowResult = async (roundId, winnerUserId) => {
  const response = await axiosClient.post(`/rounds/${roundId}/show/result`, { winnerUserId });
  return response.data;
};

// Hybrid: host calls this after local engine completes a round, to sync result to server
export const settleRound = async (roundId, { winnerId, potAmount, playerContributions }) => {
  const response = await axiosClient.post(`/rounds/${roundId}/settle`, {
    winnerId,
    potAmount,
    playerContributions,
  });
  return response.data;
};
