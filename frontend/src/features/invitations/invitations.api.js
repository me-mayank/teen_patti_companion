import axiosClient from '../../shared/api/axiosClient';

export const invitePlayers = async (gameId, userIds) => {
  const response = await axiosClient.post(`/games/${gameId}/invitations`, { userIds });
  return response.data;
};

export const resendInvite = async (invitationId) => {
  const response = await axiosClient.post(`/invitations/${invitationId}/resend`);
  return response.data;
};

export const getGameInvitations = async (gameId) => {
  const response = await axiosClient.get(`/games/${gameId}/invitations`);
  return response.data;
};

export const respondToInvite = async (invitationId, status) => {
  const response = await axiosClient.post(`/invitations/${invitationId}/respond`, { status });
  return response.data;
};

export const getMyInvitations = async () => {
  const response = await axiosClient.get('/invitations/me');
  return response.data;
};
