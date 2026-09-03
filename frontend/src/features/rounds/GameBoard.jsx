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
      let updatedRound;
      switch (action) {
        case 'BET':
          updatedRound = await roundApi.bet(round._id);
          break;
        case 'BET_TWICE':
          updatedRound = await roundApi.betTwice(round._id);
          break;
        case 'PACK':
          updatedRound = await roundApi.pack(round._id);
          break;
        case 'SHOW_REQUEST':
          updatedRound = await roundApi.requestShow(round._id);
          break;
        case 'SIDE_SHOW_REQUEST':
          updatedRound = await roundApi.requestSideShow(round._id);
          break;
      }
      if (updatedRound) setRound(updatedRound);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || `Failed to perform ${action}`);
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

  const isMyTurn = round && round.players[round.currentTurnIndex]?.userId?._id === user._id;
  const activePlayersCount = round?.players?.filter(p => p.status === 'ACTIVE').length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (game?.status === 'ENDED') {
    const winner = game.participants?.length > 0 ? game.participants.reduce((prev, current) => (prev.balance > current.balance) ? prev : current) : null;
    
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
        
        {/* Side Show Overlay */}
        {round?.status === 'SIDE_SHOW_PENDING' && (() => {
          const ssReq = round.sideShowRequest;
          const isTarget = ssReq?.targetPlayer === user._id;
          const isRequester = ssReq?.requestedBy === user._id;
          const targetPlayerObj = round.players.find(p => p.userId?._id === ssReq?.targetPlayer);
          const reqPlayerObj = round.players.find(p => p.userId?._id === ssReq?.requestedBy);

          if (ssReq?.result === 'PENDING') {
            return (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
                <h2 className="text-3xl font-bold text-[#D7A656] mb-6">Side Show Requested!</h2>
                {isTarget ? (
                  <>
                    <p className="text-xl text-white mb-8">{reqPlayerObj?.userId?.name} wants a Side Show with you.</p>
                    <div className="flex gap-6">
                      <button 
                        onClick={async () => { setProcessing(true); try { const updated = await roundApi.respondSideShow(round._id, true); setRound(updated); } catch (e) { alert(e.response?.data?.message || 'Error'); } finally { setProcessing(false); } }}
                        disabled={processing}
                        className="bg-[#D7A656] text-black font-bold px-8 py-3 rounded-xl hover:bg-[#c2954c] transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={async () => { setProcessing(true); try { const updated = await roundApi.respondSideShow(round._id, false); setRound(updated); } catch (e) { alert(e.response?.data?.message || 'Error'); } finally { setProcessing(false); } }}
                        disabled={processing}
                        className="bg-red-950/50 border border-red-500/50 text-red-500 font-bold px-8 py-3 rounded-xl hover:bg-red-900/50 transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xl text-slate-300 animate-pulse text-center">
                    {isRequester ? `Waiting for ${targetPlayerObj?.userId?.name} to respond...` : `Waiting for ${targetPlayerObj?.userId?.name} to respond to ${reqPlayerObj?.userId?.name}...`}
                  </p>
                )}
              </div>
            );
          }
          
          if (ssReq?.result === 'ACCEPTED') {
            return (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
                <h2 className="text-3xl font-bold text-[#D7A656] mb-6">Side Show: Compare Cards!</h2>
                {(isTarget || isRequester) ? (
                  <>
                    <p className="text-lg text-slate-300 mb-8 text-center max-w-md">Compare your cards in real life. Please select the player who <strong>LOST</strong> the side show.</p>
                    <div className="flex gap-4 sm:gap-8 justify-center">
                      {[reqPlayerObj, targetPlayerObj].map(p => (
                         <button
                           key={p.userId?._id}
                           onClick={async () => {
                             setProcessing(true);
                             try { const updated = await roundApi.submitSideShowResult(round._id, p.userId?._id); setRound(updated); }
                             catch (e) { alert(e.response?.data?.message || 'Error'); }
                             finally { setProcessing(false); }
                           }}
                           disabled={processing}
                           className="bg-[#12100F] border-2 border-red-500/30 hover:border-red-500 hover:bg-[#1A1714] p-6 rounded-2xl flex flex-col items-center gap-4 transition-all min-w-[160px] shadow-lg shadow-black/50"
                         >
                           <div className="w-20 h-20 rounded-full bg-[#070606] border-2 border-red-500/50 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                             {p.userId?.name?.charAt(0).toUpperCase()}
                           </div>
                           <span className="font-bold text-xl text-white">{p.userId?.name}</span>
                           <span className="text-red-500 text-sm font-medium">Select as Loser</span>
                         </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xl text-slate-300 animate-pulse text-center">
                    {reqPlayerObj?.userId?.name} and {targetPlayerObj?.userId?.name} are comparing cards...
                  </p>
                )}
              </div>
            );
          }
        })()}

        {/* Showdown Overlay */}
        {round?.status === 'SHOW_PENDING' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
            <h2 className="text-3xl font-bold text-[#D7A656] mb-2">Showdown!</h2>
            {game?.createdBy?._id === user._id ? (
              <>
                <p className="text-slate-300 mb-8 text-center max-w-md">
                  Please compare the cards. Click on the winner to distribute the pot of ₹{round.potAmount}.
                </p>
                <div className="flex gap-4 sm:gap-8 flex-wrap justify-center">
                  {round.players.filter(p => p.status === 'ACTIVE').map(p => (
                    <button
                      key={p.userId?._id}
                      onClick={async () => {
                        setProcessing(true);
                        try {
                          const updated = await roundApi.submitShowResult(round._id, p.userId?._id);
                          setRound(updated);
                        } catch (err) {
                          alert(err.response?.data?.message || 'Failed to submit show result');
                        } finally {
                          setProcessing(false);
                        }
                      }}
                      disabled={processing}
                      className="bg-[#12100F] border-2 border-[#D7A656]/30 hover:border-[#D7A656] hover:bg-[#1A1714] p-6 rounded-2xl flex flex-col items-center gap-4 transition-all min-w-[160px] shadow-lg shadow-black/50"
                    >
                      <div className="w-20 h-20 rounded-full bg-[#070606] border-2 border-[#D7A656]/50 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                        {p.userId?.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-xl text-white">{p.userId?.name}</span>
                      <span className="text-[#D7A656] text-sm font-medium">Select Winner</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-400 font-medium bg-[#12100F] px-6 py-4 rounded-xl animate-pulse border border-[#D7A656]/20 mt-4 text-center max-w-md">
                Comparing cards...<br/>Waiting for creator to declare the winner.
              </p>
            )}
          </div>
        )}

        {/* Round Completed Overlay */}
        {round?.status === 'COMPLETED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-50 p-4">
             <Crown className="text-yellow-400 w-20 h-20 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
             <h2 className="text-4xl font-bold text-emerald-400 mb-2 text-center">{round.winnerId?.name || 'Someone'} Won!</h2>
             <p className="text-2xl text-white font-medium mb-12">Total Pot: ₹{round.potAmount}</p>

             {game?.createdBy?._id === user._id ? (
               <button 
                 onClick={handleStartRound}
                 disabled={processing}
                 className="bg-emerald-500 text-slate-950 font-bold px-10 py-4 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:scale-105 transition-all flex items-center gap-2 text-lg"
               >
                 {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Start Next Round'}
               </button>
             ) : (
               <p className="text-slate-400 font-medium bg-slate-900 px-6 py-3 rounded-full animate-pulse border border-slate-800">
                 Waiting for creator to start next round...
               </p>
             )}
          </div>
        )}

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

        <div className="relative w-full max-w-[500px] mx-auto aspect-square flex items-center justify-center mb-4 mt-4 sm:mt-8">
          
          {/* SVG Table Background */}
          {round?.players && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100">
              {/* Outer ring */}
              <circle cx="50" cy="50" r="48" fill="none" stroke="#D7A656" strokeWidth="0.2" opacity="0.6" />
              
              {/* Inner Pot ring */}
              <circle cx="50" cy="50" r="22" fill="none" stroke="#D7A656" strokeWidth="0.4" opacity="0.6" />
              
              {/* Radiating lines & Badges */}
              {round.players.map((_, i) => {
                const totalPlayers = round.players.length;
                const playerAngle = (i / totalPlayers) * 2 * Math.PI - Math.PI / 2;
                const lineAngle = playerAngle + (Math.PI / totalPlayers);
                
                const lineX1 = 50 + 22 * Math.cos(lineAngle);
                const lineY1 = 50 + 22 * Math.sin(lineAngle);
                const lineX2 = 50 + 48 * Math.cos(lineAngle);
                const lineY2 = 50 + 48 * Math.sin(lineAngle);
                
                const badgeX = 50 + 48 * Math.cos(playerAngle);
                const badgeY = 50 + 48 * Math.sin(playerAngle);

                return (
                  <g key={`slice-${i}`}>
                    <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke="#D7A656" strokeWidth="0.2" opacity="0.6" />
                    
                    {/* Badge Group */}
                    <circle cx={badgeX} cy={badgeY} r="2.5" fill="#070606" stroke="#D7A656" strokeWidth="0.3" />
                    <text x={badgeX} y={badgeY} fill="#D7A656" fontSize="2.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Central Pot Area */}
          <PotArea potAmount={round?.potAmount || 0} currentBet={round?.currentBet || game?.bootAmount || 0} />

          {/* Players Circular Layout */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {round?.players?.map((p, i) => {
              const gameParticipant = game?.participants?.find(gp => gp.userId?._id === p.userId?._id);
              const playerWithBalance = {
                ...p,
                balance: gameParticipant?.balance || 0,
                isCreator: game?.createdBy?._id === p.userId?._id
              };
              
              const totalPlayers = round.players.length;
              // Arrange them sequentially around the circle starting from top
              const angle = (i / totalPlayers) * 2 * Math.PI - Math.PI / 2;
              const radius = 31; // Decreased from 35% so players don't cover the badges
              const left = 50 + radius * Math.cos(angle);
              const top = 50 + radius * Math.sin(angle);
              
              return (
                <div 
                  key={p.userId?._id || i} 
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <PlayerCircle 
                    player={playerWithBalance} 
                    isCurrentTurn={round.currentTurnIndex === i} 
                    isMe={p.userId?._id === user._id}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Panel */}
        {round?.status === 'ACTIVE' && (
          <div className="w-full max-w-4xl mx-auto mt-auto relative z-20">
            <ActionPanel 
              isMyTurn={isMyTurn}
              isProcessing={processing}
              currentBet={round?.currentBet || game?.bootAmount || 0}
              maxBetLimit={game?.bootAmount * (game?.maxBetMultiplier || 5)}
              activePlayersCount={activePlayersCount}
              onAction={handleAction}
              currentPlayerName={round?.players?.[round?.currentTurnIndex]?.userId?.name}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
