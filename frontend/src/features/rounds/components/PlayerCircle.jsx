import { Shield } from 'lucide-react';

const PlayerCircle = ({ player, isCurrentTurn, isMe, onSideShowTargetSelect, pendingSideShow }) => {
  const isPacked = player.status === 'PACKED';
  
  return (
    <div className={`relative flex flex-col items-center transition-all ${isPacked ? 'opacity-50 grayscale' : ''}`}>
      
      {/* Player Avatar */}
      <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold mb-1 sm:mb-2 transition-all
        ${isCurrentTurn 
          ? 'bg-slate-800 border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
          : 'bg-slate-800 border-2 border-slate-700 shadow-lg shadow-black/50'
        }`}
      >
        {player.userId?.name?.charAt(0).toUpperCase()}
      </div>
      
      <div className="text-center bg-slate-950/80 px-2 py-0.5 rounded-lg backdrop-blur-md shadow-lg shadow-black/50 border border-slate-800">
        <p className="font-semibold text-xs sm:text-sm flex items-center gap-1 justify-center whitespace-nowrap text-slate-200">
          {isMe ? 'You' : player.userId?.name}
          {player.isCreator && <Shield className="w-3 h-3 text-emerald-500" />}
        </p>
        <p className="text-[10px] sm:text-xs text-slate-400">
          ₹{player.balance}
        </p>
      </div>

      {isPacked && (
        <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-red-500 font-bold text-[10px] sm:text-xs transform -rotate-12 border border-red-500 px-1 py-0.5 rounded bg-black/80 backdrop-blur-sm">PACKED</span>
        </div>
      )}

      {/* Side Show Target Selection Overlay */}
      {pendingSideShow && !isMe && !isPacked && (
        <button 
          onClick={() => onSideShowTargetSelect(player.userId?._id)}
          className="absolute inset-0 bg-emerald-500/80 rounded-full flex items-center justify-center backdrop-blur-sm text-slate-950 font-bold cursor-pointer hover:bg-emerald-400 transition-all animate-pulse z-20"
        >
          Select
        </button>
      )}
    </div>
  );
};

export default PlayerCircle;
