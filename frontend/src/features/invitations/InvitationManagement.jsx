import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as gamesApi from '../games/games.api';
import * as invitationsApi from './invitations.api';
import { useSocket } from '../../shared/hooks/useSocket';
import { ArrowLeft, Users, Loader2, CheckCircle2, Clock, XCircle, Play } from 'lucide-react';

const InvitationManagement = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  
  const [game, setGame] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  const fetchLobbyData = async () => {
    try {
      const [gameData, invitesData] = await Promise.all([
        gamesApi.getGameById(gameId),
        invitationsApi.getGameInvitations(gameId)
      ]);
      setGame(gameData);
      setInvitations(invitesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbyData();
  }, [gameId]);

  useEffect(() => {
    if (socket) {
      socket.emit('joinGame', gameId);
      
      socket.on('game:update', () => {
        // Someone responded to an invite, fetch fresh data
        fetchLobbyData();
      });

      return () => {
        socket.off('game:update');
      };
    }
  }, [socket, gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Game not found
      </div>
    );
  }

  const acceptedCount = invitations.filter(i => i.status === 'ACCEPTED').length;

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await gamesApi.finalizePlayers(gameId);
      navigate(`/games/${gameId}/turn-order`);
    } catch (error) {
      console.error('Failed to finalize:', error);
      alert(error.response?.data?.message || 'Failed to finalize game');
      setFinalizing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACCEPTED': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'DECLINED': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 z-10 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-900 rounded-full hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{game.name}</h1>
              <p className="text-xs text-slate-400">Status: {game.status}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-8">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Waiting for Players</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Invitations have been sent. Wait for players to accept before finalizing the game.
            The list below will update automatically.
          </p>
          
          <div className="flex justify-center gap-8 mt-6 py-4 border-t border-slate-800">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">{acceptedCount}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Accepted</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-400">{invitations.filter(i => i.status === 'PENDING').length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">{invitations.filter(i => i.status === 'DECLINED').length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Declined</p>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Invited Players
        </h3>
        
        <div className="space-y-3 mb-8">
          {invitations.map((inv) => (
            <div key={inv._id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">{inv.invitedUserId?.name}</p>
                <p className="text-xs text-slate-500">@{inv.invitedUserId?.username}</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                {getStatusIcon(inv.status)}
                <span className="text-sm font-medium">{inv.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Phase 3 preview button */}
        <button
          disabled={acceptedCount < 1 || finalizing} 
          onClick={handleFinalize}
          className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {finalizing ? 'Finalizing...' : (
            <>Finalize Players <Play className="w-5 h-5" /></>
          )}
        </button>

      </div>
    </div>
  );
};

export default InvitationManagement;
