import { Shield } from 'lucide-react';

const PlayerCircle = ({ player, isCurrentTurn, isMe, onSideShowTargetSelect, pendingSideShow }) => {
  const isPacked = player.status === 'PACKED';
  
  return (
    <div className={`relative flex flex-col items-center p-3 rounded-2xl transition-all ${
      isCurrentTurn ? 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/50' : 'bg-slate-900/50 border border-slate-800'
    } ${isPacked ? 'opacity-50 grayscale' : ''}`}>
      
      {/* Player Avatar placeholder */}
      <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xl font-bold mb-2">
        {player.userId?.name?.charAt(0).toUpperCase()}
      </div>
      
      <div className="text-center">
        <p className="font-semibold text-sm flex items-center gap-1 justify-center">
          {isMe ? 'You' : player.userId?.name}
          {player.isCreator && <Shield className="w-3 h-3 text-emerald-500" />}
        </p>
        <p className="text-xs text-slate-400">
          ₹{player.balance}
        </p>
      </div>

      {isPacked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-sm">
          <span className="text-red-500 font-bold text-sm transform -rotate-12 border-2 border-red-500 px-2 py-0.5 rounded">PACKED</span>
        </div>
      )}

      {/* Side Show Target Selection Overlay */}
      {pendingSideShow && !isMe && !isPacked && (
        <button 
          onClick={() => onSideShowTargetSelect(player.userId?._id)}
          className="absolute inset-0 bg-emerald-500/80 rounded-2xl flex items-center justify-center backdrop-blur-sm text-slate-950 font-bold cursor-pointer hover:bg-emerald-400 transition-all animate-pulse"
        >
          Select
        </button>
      )}
    </div>
  );
};

export default PlayerCircle;
