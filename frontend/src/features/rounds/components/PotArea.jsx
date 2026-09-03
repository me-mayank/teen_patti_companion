const PotArea = ({ potAmount, currentBet }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-900/60 rounded-full border-2 sm:border-4 border-slate-800 w-40 h-40 sm:w-64 sm:h-64 shadow-2xl shadow-emerald-500/5 relative shrink-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-emerald-500/10 to-transparent"></div>
      <div className="relative z-10 text-center">
        <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-widest font-semibold mb-1">Total Pot</p>
        <p className="text-2xl sm:text-4xl font-bold text-emerald-400">₹{potAmount}</p>
        <div className="mt-2 sm:mt-4 inline-block bg-slate-950 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-slate-800 shadow-inner">
          <p className="text-[10px] sm:text-xs text-slate-400">Current Bet: <span className="text-white font-medium">₹{currentBet}</span></p>
        </div>
      </div>
    </div>
  );
};

export default PotArea;
