const PotArea = ({ potAmount, currentBet }) => {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-20 pointer-events-none w-[35%] h-[35%] rounded-full">
      <div className="text-center">
        <p className="text-[10px] sm:text-xs text-[#D7A656]/70 uppercase tracking-widest font-semibold mb-1">Total Pot</p>
        <p className="text-3xl sm:text-4xl font-bold text-[#D7A656]">₹{potAmount}</p>
        <div className="mt-2 inline-block bg-black/60 px-3 py-1 rounded-full border border-[#D7A656]/30 backdrop-blur-md">
          <p className="text-[10px] sm:text-xs text-slate-300">Current Bet: <span className="text-white font-medium">₹{currentBet}</span></p>
        </div>
      </div>
    </div>
  );
};

export default PotArea;
