import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as gamesApi from './games.api';
import * as usersApi from '../users/users.api';
import { ArrowLeft, Search, Check, AlertCircle } from 'lucide-react';

const CreateGame = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [bootAmount, setBootAmount] = useState(10);
  const [maxBetMultiplier, setMaxBetMultiplier] = useState(5);
  
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch users for multi-select
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await usersApi.searchUsers(searchQuery);
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => 
      prev.includes(userId) 
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (selectedUserIds.length === 0) {
      setError('You must invite at least one player to start a game.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the game
      const newGame = await gamesApi.createGame({
        name,
        bootAmount: Number(bootAmount),
        maxBetMultiplier: Number(maxBetMultiplier),
      });

      // 2. Send invitations
      const { invitePlayers } = await import('../invitations/invitations.api');
      await invitePlayers(newGame._id, selectedUserIds);

      // 3. Redirect to Invitation Management / Game Lobby
      navigate(`/games/${newGame._id}/lobby`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 z-10 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link to="/" className="p-2 bg-slate-900 rounded-full hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <h1 className="text-xl font-semibold">Create New Game</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Game Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">Game Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Game Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Friday Night Teen Patti"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Boot Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={bootAmount}
                    onChange={(e) => setBootAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Max Bet Limit</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={maxBetMultiplier}
                      onChange={(e) => setMaxBetMultiplier(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                    <span className="absolute right-4 top-3.5 text-slate-500">× Boot</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">Invite Players</h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Search friends by name or username..."
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl h-64 overflow-y-auto p-2">
              {users.length > 0 ? (
                users.map((u) => (
                  <div 
                    key={u._id}
                    onClick={() => toggleUser(u._id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                      selectedUserIds.includes(u._id) ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${selectedUserIds.includes(u._id) ? 'text-emerald-300' : 'text-white'}`}>{u.name}</p>
                      <p className="text-xs text-slate-500">@{u.username}</p>
                    </div>
                    {selectedUserIds.includes(u._id) && (
                      <Check className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  {searchQuery ? 'No players found.' : 'Search to invite players.'}
                </div>
              )}
            </div>
            
            <div className="mt-4 text-sm text-slate-400">
              {selectedUserIds.length} player{selectedUserIds.length !== 1 ? 's' : ''} selected
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || selectedUserIds.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? 'Creating...' : 'Create & Send Invites'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGame;
