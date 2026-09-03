import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as gamesApi from '../games/games.api';
import { Loader2, CheckCircle, Shield, ChevronUp, ChevronDown } from 'lucide-react';

const TurnOrderSetup = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameData = await gamesApi.getGameById(gameId);
        setGame(gameData);
        // Map participants to just the user objects
        setParticipants(gameData.participants.map(p => p.userId));
      } catch (err) {
        console.error(err);
        setError('Failed to load game');
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  const moveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...participants];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setParticipants(newOrder);
  };

  const moveDown = (index) => {
    if (index === participants.length - 1) return;
    const newOrder = [...participants];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setParticipants(newOrder);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      const orderedIds = participants.map(p => p._id);
      await gamesApi.setTurnOrder(gameId, orderedIds);
      await gamesApi.startGame(gameId);
      navigate(`/games/${gameId}/board`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start game');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Set Turn Order</h1>
          <p className="text-slate-400">Use the Up and Down buttons to arrange the players.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="space-y-3">
            {participants.map((p, index) => {
              const isCreator = game.createdBy?._id === p._id;
              
              return (
                <div 
                  key={p._id} 
                  className="flex items-center gap-4 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-lg"
                >
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex shrink-0 items-center justify-center text-sm font-bold text-slate-400">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{p.name}</span>
                      {isCreator && <Shield className="w-4 h-4 text-emerald-500" />}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => moveDown(index)}
                      disabled={index === participants.length - 1}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Confirm & Start Game <CheckCircle className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TurnOrderSetup;
