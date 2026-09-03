import axiosClient from '../../shared/api/axiosClient';

export const searchUsers = async (query = '') => {
  const response = await axiosClient.get(`/users?search=${query}`);
  return response.data;
};

export const changeUsername = async (username) => {
  const response = await axiosClient.put('/users/username', { username });
  return response.data;
};

export const updateProfilePicture = async (profilePicture) => {
  const response = await axiosClient.put('/users/profile-picture', { profilePicture });
  return response.data;
};
