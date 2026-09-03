import { Loader2 } from 'lucide-react';

const ActionPanel = ({ isMyTurn, isProcessing, currentBet, maxBetLimit, activePlayersCount, onAction }) => {
  if (!isMyTurn) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-center min-h-[120px]">
        <p className="text-slate-400 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Waiting for other players...
        </p>
      </div>
    );
  }

  const canBetTwice = (currentBet * 2) <= maxBetLimit;
  const canSideShow = activePlayersCount > 2;
  const canShow = activePlayersCount === 2;

  return (
    <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
      <h3 className="text-emerald-400 font-semibold mb-4 text-center">It's Your Turn!</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <button 
          onClick={() => onAction('PACK')} 
          disabled={isProcessing}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          Pack
        </button>
        
        <button 
          onClick={() => onAction('BET')} 
          disabled={isProcessing}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          Bet (₹{currentBet})
        </button>
        
        <button 
          onClick={() => onAction('BET_TWICE')} 
          disabled={!canBetTwice || isProcessing}
          className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          Bet 2x (₹{currentBet * 2})
        </button>

        {canSideShow && (
          <button 
            onClick={() => onAction('SIDE_SHOW_REQUEST')} 
            disabled={isProcessing}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Side Show
          </button>
        )}

        {canShow && (
          <button 
            onClick={() => onAction('SHOW_REQUEST')} 
            disabled={isProcessing}
            className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Show
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;
