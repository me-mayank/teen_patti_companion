const PotArea = ({ potAmount, currentBet }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 rounded-full border-4 border-slate-800 w-64 h-64 shadow-2xl shadow-emerald-500/5 relative">
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-emerald-500/10 to-transparent"></div>
      <div className="relative z-10 text-center">
        <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold mb-1">Total Pot</p>
        <p className="text-4xl font-bold text-emerald-400">₹{potAmount}</p>
        <div className="mt-4 inline-block bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800 shadow-inner">
          <p className="text-xs text-slate-400">Current Bet: <span className="text-white font-medium">₹{currentBet}</span></p>
        </div>
      </div>
    </div>
  );
};

export default PotArea;
