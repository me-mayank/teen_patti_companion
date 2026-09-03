import { Shield } from 'lucide-react';

const PlayerCircle = ({ player, isCurrentTurn, isMe }) => {
  const isPacked = player.status === 'PACKED';
  
  return (
    <div className={`relative flex flex-col items-center transition-all ${isPacked ? 'opacity-50 grayscale' : ''}`}>
      
      {/* Player Avatar */}
      <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mb-1 sm:mb-2 transition-all
        ${isCurrentTurn 
          ? 'bg-[#12100F] border-[3px] border-[#D7A656] shadow-[0_0_25px_rgba(215,166,86,0.6)] text-white ring-2 ring-[#D7A656]/50 ring-offset-2 ring-offset-transparent' 
          : 'bg-[#12100F] border-2 border-[#D7A656]/40 shadow-lg shadow-black/50 text-white hover:border-[#D7A656]/70'
        }`}
      >
        {player.userId?.name?.charAt(0).toUpperCase()}
      </div>
      
      <div className="text-center bg-[#070606]/95 px-3 py-1 rounded-xl backdrop-blur-md shadow-xl border border-[#D7A656]/20">
        <p className="font-semibold text-xs sm:text-sm flex items-center gap-1 justify-center whitespace-nowrap text-white">
          {isMe ? 'You' : player.userId?.name}
          {player.isCreator && <Shield className="w-3 h-3 text-[#D7A656]" />}
        </p>
        <p className="text-[10px] sm:text-xs text-[#D7A656]/80 mt-0.5">
          ₹{player.balance}
        </p>
      </div>

      {isPacked && (
        <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-red-500 font-bold text-[10px] sm:text-xs transform -rotate-12 border border-red-500 px-1 py-0.5 rounded bg-black/80 backdrop-blur-sm">PACKED</span>
        </div>
      )}


    </div>
  );
};

export default PlayerCircle;
