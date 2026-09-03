import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as gamesApi from './games.api';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const GameHistory = () => {
  const { id: gameId } = useParams();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, txData] = await Promise.all([
          gamesApi.getGameSummary(gameId),
          gamesApi.getGameTransactions(gameId)
        ]);
        setSummary(summaryData);
        setTransactions(txData);
      } catch (err) {
        console.error(err);
        setError('Failed to load game history');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="p-2 bg-slate-900 rounded-full hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Game Summary</h1>
            <p className="text-slate-400">Game Status: {summary?.status}</p>
          </div>
        </div>

        {/* Zero-Sum Validation Banner */}
        <div className={`p-4 rounded-xl flex items-center gap-3 mb-8 ${summary?.isZeroSum ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          {summary?.isZeroSum ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-500" />
          )}
          <div>
            <h3 className={`font-semibold ${summary?.isZeroSum ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary?.isZeroSum ? 'Ledger Balanced (Zero-Sum Verified)' : 'Ledger Imbalance Detected!'}
            </h3>
            <p className="text-sm text-slate-400">
              Total system sum: ₹{summary?.totalSum.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Final Balances */}
          <div className="md:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4 text-emerald-400">Final Balances</h2>
              <div className="overflow-x-auto">
                <div className="space-y-4 min-w-[200px]">
                  {summary?.balances.map(b => (
                    <div key={b.user._id} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div>
                        <p className="font-medium text-slate-200">{b.user.name}</p>
                        <p className="text-xs text-slate-500">@{b.user.username}</p>
                      </div>
                      <span className={`font-bold ${b.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {b.balance >= 0 ? '+' : ''}₹{b.balance.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Timeline */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-4 text-slate-300">Transaction Timeline</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[600px] p-6 space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-center text-slate-500">No transactions recorded.</p>
                ) : (
                  transactions.map(tx => (
                    <div key={tx._id} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                          {tx.type.substring(0, 3)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{tx.userId.name} <span className="text-slate-500 text-sm">did</span> {tx.type}</p>
                          <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}₹{tx.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GameHistory;
