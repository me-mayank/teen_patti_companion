import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ArrowLeft, User, Mail, Wallet, Shield, Edit2, Loader2, X } from 'lucide-react';
import axiosClient from '../../shared/api/axiosClient';
import * as usersApi from './users.api';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [editing, setEditing] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get('/auth/me');
      setProfileData(res.data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setEditing(true);
    try {
      await usersApi.changeUsername(newUsername);
      await fetchProfile(); // refresh data
      setShowEditUsername(false);
      setNewUsername('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change username');
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
            My Profile
          </h1>
          <div className="w-10"></div> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Wallet Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-6 shadow-xl shadow-emerald-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Wallet className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <p className="text-emerald-100 font-medium mb-1">Wallet Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    ₹{profileData?.globalBalance?.toLocaleString() || 0}
                  </span>
                </div>
                <p className="text-sm text-emerald-100/80 mt-2">
                  Use this balance to buy into games.
                </p>
              </div>
            </div>

            {/* User Details */}
            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800/50 flex items-center gap-3">
                <User className="text-emerald-400 w-5 h-5" />
                <span className="text-slate-400 font-medium text-sm">Display Name</span>
                <span className="text-white ml-auto">{profileData?.name}</span>
              </div>
              <div className="p-4 border-b border-slate-800/50 flex items-center gap-3">
                <Shield className="text-emerald-400 w-5 h-5" />
                <span className="text-slate-400 font-medium text-sm">Username</span>
                <span className="text-white ml-auto">@{profileData?.username}</span>
                <button 
                  onClick={() => setShowEditUsername(true)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center gap-3">
                <Mail className="text-emerald-400 w-5 h-5" />
                <span className="text-slate-400 font-medium text-sm">Email Address</span>
                <span className="text-white ml-auto truncate max-w-[200px] sm:max-w-none">{profileData?.email}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Username Modal */}
      {showEditUsername && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowEditUsername(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">
              Change Username
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Changing your username costs <strong className="text-yellow-400">₹1,000</strong> from your global wallet.
            </p>
            <form onSubmit={handleChangeUsername}>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                placeholder="New Username"
                required
                minLength={3}
                maxLength={20}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-emerald-500 text-white"
              />
              <button
                type="submit"
                disabled={editing || !newUsername}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {editing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pay ₹1000 & Change'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
