import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as gamesApi from './games.api';
import * as invitationsApi from '../invitations/invitations.api';
import { Plus, Play, History, Bell, LogOut, Loader2, Check, X, UserCircle, Info, Download } from 'lucide-react';
import logo from '../../assets/logo.png';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeGames, setActiveGames] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // active or history
  
  const [showInfo, setShowInfo] = useState(false);
  const [showManualInstall, setShowManualInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsStandalone(true);
    }
    
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.globalDeferredPrompt;
    
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        window.globalDeferredPrompt = null;
        setIsStandalone(true);
      }
    } else {
      setShowManualInstall(true);
    }
  };

  const loadData = async () => {
    try {
      const [gamesData, historyData, invitesData] = await Promise.all([
        gamesApi.getActiveGames(),
        gamesApi.getGameHistory(),
        invitationsApi.getMyInvitations(),
      ]);
      setActiveGames(gamesData);
      setGameHistory(historyData);
      setPendingInvites(invitesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // In a real app, you might listen to socket events here to auto-refresh
  }, []);

  const handleInviteResponse = async (invitationId, status) => {
    try {
      await invitationsApi.respondToInvite(invitationId, status);
      // Reload data to reflect changes (game might now be active)
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 md:p-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-emerald-500/10 rounded-full mix-blend-screen filter blur-3xl overflow-hidden"></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start sm:items-center mb-8 sm:mb-12">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/20 border border-emerald-500/30">
              <img src={logo} alt="Teen Patti Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-200 truncate max-w-[160px] sm:max-w-none">
                Hello, {user.name.split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-base text-slate-400">Ready to play?</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-full transition-all shadow-lg shadow-emerald-500/20"
                title="Install App"
              >
                <Download className="w-4 h-4" /> Install App
              </button>
            )}
            <button 
              onClick={() => setShowInfo(true)}
              className="p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="About this App"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={() => navigate('/profile')}
              className={`bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center overflow-hidden ${user?.profilePicture ? 'w-[34px] h-[34px] sm:w-[46px] sm:h-[46px]' : 'p-2 sm:p-3'}`}
              title="Profile"
            >
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Install Button */}
        {!isStandalone && (
          <button 
            onClick={handleInstallClick}
            className="sm:hidden w-full flex justify-center items-center gap-2 mb-6 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-5 h-5" /> Install Teen Patti Companion
          </button>
        )}

        {/* Invitations Section */}
        {pendingInvites.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-400" />
              Game Invitations ({pendingInvites.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map((invite) => (
                <div key={invite._id} className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 p-5 rounded-2xl shadow-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-emerald-100">{invite.gameId?.name || 'A Game'}</h3>
                    <p className="text-sm text-slate-400">Invited by {invite.invitedBy?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">Boot: ₹{invite.gameId?.bootAmount}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleInviteResponse(invite._id, 'ACCEPTED')}
                      className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleInviteResponse(invite._id, 'DECLINED')}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex justify-between items-end mb-6">
          <div className="flex gap-6 border-b border-slate-800 w-full md:w-auto">
            <button 
              className={`pb-3 font-medium transition-colors ${activeTab === 'active' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('active')}
            >
              Active Games
            </button>
            <button 
              className={`pb-3 font-medium transition-colors ${activeTab === 'history' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>
          
          <Link 
            to="/games/create" 
            className="hidden md:flex items-center gap-2 bg-emerald-500 text-slate-950 font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" /> Create Game
          </Link>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {activeTab === 'active' ? (
            activeGames.length > 0 ? (
              activeGames.map((game) => (
                <div key={game._id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{game.name}</h3>
                    <div className="flex gap-3 text-sm text-slate-400">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">{game.status}</span>
                      <span>Creator: {game.createdBy?.name}</span>
                    </div>
                  </div>
                  <Link 
                    to={
                      ['CREATED', 'WAITING_FOR_PLAYERS'].includes(game.status) ? `/games/${game._id}/lobby` :
                      ['PLAYERS_FINALIZED', 'TURN_ORDER_SETUP'].includes(game.status) ? `/games/${game._id}/turn-order` :
                      ['ENDED', 'ARCHIVED'].includes(game.status) ? `/games/${game._id}/history` :
                      `/games/${game._id}/board`
                    }
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl transition-all"
                  >
                    Enter Game <Play className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
                <p className="text-slate-400 mb-4">No active games right now.</p>
                <Link to="/games/create" className="inline-flex items-center gap-2 bg-emerald-500 text-slate-950 font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-400 transition-all">
                  <Plus className="w-5 h-5" /> Start a New Game
                </Link>
              </div>
            )
          ) : (
            gameHistory.length > 0 ? (
              gameHistory.map((game) => (
                <div key={game._id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl opacity-75 hover:opacity-100 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{game.name}</h3>
                      <p className="text-sm text-slate-400">Ended on {new Date(game.endedAt || game.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Link to={`/games/${game._id}/history`} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <History className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                No past games found.
              </div>
            )
          )}
        </div>

        {/* Mobile FAB */}
        <Link 
          to="/games/create" 
          className="md:hidden fixed bottom-8 right-8 w-14 h-14 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all z-50"
        >
          <Plus className="w-6 h-6" />
        </Link>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <Info className="w-6 h-6" /> About this App
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>
                <strong>Teen Patti Companion</strong> is a premium digital ledger and game manager for your real-world, physical Teen Patti games.
              </p>
              <p>
                Instead of using poker chips or keeping track of money on paper, use this app to automatically track bets, pots, turn orders, side-shows, and end-of-game payouts.
              </p>
              <ul className="list-disc pl-5 text-slate-400 space-y-1">
                <li>Create games and invite friends</li>
                <li>Set custom boot amounts and bet limits</li>
                <li>Track global balances seamlessly</li>
                <li>Install as an app on your phone (PWA)</li>
              </ul>
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="mt-8 w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Manual Install Modal */}
      {showManualInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowManualInstall(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <Download className="w-6 h-6" /> Install App
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>Your browser requires a manual installation step.</p>
              <p className="text-sm text-slate-400">
                <strong>iOS (Safari):</strong> Tap the <strong>Share</strong> icon at the bottom of the screen, scroll down, and tap <strong>"Add to Home Screen"</strong>.
              </p>
              <p className="text-sm text-slate-400">
                <strong>Android / Others:</strong> Tap the <strong>3-dot menu</strong> icon in the top right, and select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
              </p>
            </div>
            <button 
              onClick={() => setShowManualInstall(false)}
              className="mt-8 w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-all"
            >
              Okay, I'll do that!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
