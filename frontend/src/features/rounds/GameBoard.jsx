import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../../shared/hooks/useSocket';
import * as gamesApi from '../games/games.api';
import * as roundApi from './round.api';
import { Loader2, Crown } from 'lucide-react';
import PlayerCircle from './components/PlayerCircle';
import PotArea from './components/PotArea';
import ActionPanel from './components/ActionPanel';

const GameBoard = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();

  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // States for special workflows (Side Show / Show)
  const [pendingTargetSelection, setPendingTargetSelection] = useState(false);

  const fetchGameState = useCallback(async () => {
    try {
      const g = await gamesApi.getGameById(gameId);
      setGame(g);
      
      const r = await gamesApi.getCurrentRound(gameId);
      setRound(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGameState();
  }, [fetchGameState]);

  useEffect(() => {
    if (socket) {
      socket.emit('joinGame', gameId);
      
      socket.on('round:update', fetchGameState);
      socket.on('game:update', fetchGameState);
      socket.on('round:completed', () => {
        // Show winner modal or similar, then refresh
        fetchGameState();
      });

      return () => {
        socket.off('round:update');
        socket.off('game:update');
        socket.off('round:completed');
      };
    }
  }, [socket, gameId, fetchGameState]);

  const handleAction = async (action) => {
    setProcessing(true);
    try {
      switch (action) {
        case 'BET':
          await roundApi.bet(round._id);
          break;
        case 'BET_TWICE':
          await roundApi.betTwice(round._id);
          break;
        case 'PACK':
          await roundApi.pack(round._id);
          break;
        case 'SHOW_REQUEST':
          await roundApi.requestShow(round._id);
          break;
        case 'SIDE_SHOW_REQUEST':
          setPendingTargetSelection(true);
          setProcessing(false);
          return;
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || `Failed to perform ${action}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSideShowTargetSelect = async (targetUserId) => {
    setPendingTargetSelection(false);
    setProcessing(true);
    try {
      await roundApi.requestSideShow(round._id, targetUserId);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request side show');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartRound = async () => {
    setProcessing(true);
    try {
      await roundApi.startRound(gameId);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start round');
    } finally {
      setProcessing(false);
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm("Are you sure you want to end this game?")) return;
    setProcessing(true);
    try {
      await gamesApi.endGame(gameId);
      // We don't navigate immediately; the socket will update game.status to 'ENDED'
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end game');
    } finally {
      setProcessing(false);
    }
  };

  const isMyTurn = round && round.players[round.currentTurnIndex]?.userId._id === user._id;
  const activePlayersCount = round?.players.filter(p => p.status === 'ACTIVE').length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (game?.status === 'ENDED') {
    const winner = game.participants?.reduce((prev, current) => (prev.balance > current.balance) ? prev : current);
    
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
          <Crown className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">Game Over!</h2>
          <p className="text-slate-400 mb-8">The final scores have been tallied and balances applied to profiles.</p>
          
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-8">
            <p className="text-emerald-400 font-medium mb-1">Overall Winner</p>
            <p className="text-2xl font-bold text-white mb-2">{winner?.userId?.name || winner?.userId?.username}</p>
            <p className="text-xl font-bold text-emerald-400">+₹{winner?.balance?.toLocaleString() || 0}</p>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => navigate(`/games/${gameId}/history`)}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3 rounded-xl transition-all"
            >
              Full History
            </button>
            <button 
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-all"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If game is active but no round is loaded (need to fetch it properly in a real scenario, this is a simplified flow)
  // To keep it simple, we will assume we have round data if we fetch it.
  
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none"></div>
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-10 relative bg-slate-950/50 backdrop-blur-md border-b border-slate-800">
        <div>
          <h1 className="font-bold text-lg">{game?.name}</h1>
          <p className="text-xs text-slate-400">Round {game?.currentRoundNumber || 0}</p>
        </div>
        <div className="flex gap-2">
          {game?.createdBy?._id === user._id && (
            <button 
              onClick={handleEndGame}
              disabled={processing}
              className="text-sm bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              End Game
            </button>
          )}
          <button 
            onClick={() => navigate('/')}
            className="text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Leave Table
          </button>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
        
        {/* Placeholder for when no round is active */}
        {!round && game?.currentRoundNumber === 0 && game?.createdBy?._id === user._id && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50">
            <button 
              onClick={handleStartRound}
              disabled={processing}
              className="bg-emerald-500 text-slate-950 font-bold px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all flex items-center gap-2"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start First Round'}
            </button>
          </div>
        )}

        <div className="relative w-full max-w-4xl aspect-square md:aspect-video flex items-center justify-center mb-4 sm:mb-8 mt-4 sm:mt-0">
          
          {/* Central Pot Area */}
          <PotArea potAmount={round?.potAmount || 0} currentBet={round?.currentBet || game?.bootAmount || 0} />

          {/* Players Circular Layout Placeholder (Absolute positioning based on turn order) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full flex flex-wrap items-center justify-around p-2 sm:p-8">
              {round?.players.map((p, i) => {
                const gameParticipant = game?.participants.find(gp => gp.userId._id === p.userId._id);
                const playerWithBalance = {
                  ...p,
                  balance: gameParticipant?.balance || 0,
                  isCreator: game?.createdBy?._id === p.userId._id
                };
                
                return (
                  <div key={p.userId._id} className="pointer-events-auto">
                    <PlayerCircle 
                      player={playerWithBalance} 
                      isCurrentTurn={round.currentTurnIndex === i} 
                      isMe={p.userId._id === user._id}
                      onSideShowTargetSelect={handleSideShowTargetSelect}
                      pendingSideShow={pendingTargetSelection}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="w-full max-w-4xl mx-auto mt-auto relative z-20">
          <ActionPanel 
            isMyTurn={isMyTurn}
            isProcessing={processing}
            currentBet={round?.currentBet || game?.bootAmount || 0}
            maxBetLimit={game?.bootAmount * (game?.maxBetMultiplier || 5)}
            activePlayersCount={activePlayersCount}
            onAction={handleAction}
          />
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
