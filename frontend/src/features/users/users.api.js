import axiosClient from '../../shared/api/axiosClient';

export const searchUsers = async (query = '') => {
  const response = await axiosClient.get(`/users?search=${query}`);
  return response.data;
};
