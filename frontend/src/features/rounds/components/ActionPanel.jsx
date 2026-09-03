import { Loader2 } from 'lucide-react';

const ActionPanel = ({ isMyTurn, isProcessing, currentBet, maxBetLimit, activePlayersCount, onAction, currentPlayerName }) => {
  if (!isMyTurn) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-center min-h-[120px]">
        <p className="text-slate-400 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Waiting for {currentPlayerName || 'other players'}...
        </p>
      </div>
    );
  }

  const canBetTwice = (currentBet * 2) <= maxBetLimit;
  const canSideShow = activePlayersCount > 2;
  const canShow = activePlayersCount === 2;

  return (
    <div className="bg-slate-900 border border-emerald-500/30 p-4 sm:p-6 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.1)] mx-2 sm:mx-0">
      <h3 className="text-emerald-400 font-semibold mb-3 sm:mb-4 text-center text-sm sm:text-base">It's Your Turn!</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        
        <button 
          onClick={() => onAction('PACK')} 
          disabled={isProcessing}
          className="p-2 sm:p-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/50 rounded-xl text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
        >
          Pack
        </button>
        
        <button 
          onClick={() => onAction('BET')} 
          disabled={isProcessing}
          className="p-2 sm:p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
        >
          Bet (₹{currentBet})
        </button>
        
        <button 
          onClick={() => onAction('BET_TWICE')} 
          disabled={!canBetTwice || isProcessing}
          className="p-2 sm:p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50"
        >
          Bet 2x (₹{currentBet * 2})
        </button>

        {canSideShow && (
          <button 
            onClick={() => onAction('SIDE_SHOW_REQUEST')} 
            disabled={isProcessing}
            className="p-2 sm:p-3 bg-slate-900 hover:bg-slate-800 border border-emerald-600 text-emerald-100 rounded-xl text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
          >
            Side Show
          </button>
        )}

        {canShow && (
          <button 
            onClick={() => onAction('SHOW_REQUEST')} 
            disabled={isProcessing}
            className="p-2 sm:p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
          >
            Show
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;
