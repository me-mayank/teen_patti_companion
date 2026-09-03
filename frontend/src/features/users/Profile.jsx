import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ArrowLeft, User, Mail, Wallet, Shield } from 'lucide-react';
import axiosClient from '../../shared/api/axiosClient';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchProfile();
  }, []);

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
    </div>
  );
};

export default Profile;
