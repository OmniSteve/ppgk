import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, User } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import PlayerPerformanceList from '@/components/performance/PlayerPerformanceList';

export default function ClientPlayerPerformance() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    apiClient.get(`/players/${id}`)
      .then(setPlayer)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !player) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-3">
        <User size={32} className="text-slate-500 mx-auto" />
        <p className="text-slate-400">Player not found</p>
        <Link to="/players" className="text-[#2563EB] text-sm font-semibold hover:underline">Back to Players</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/players" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors print:hidden">
        <ChevronLeft size={16} />Back to Players
      </Link>

      <div>
        <h1 className="text-2xl font-black text-white">{player.firstName} {player.lastName} — Performance</h1>
        <p className="text-slate-400 text-sm">Evaluations shared by your coach</p>
      </div>

      <PlayerPerformanceList playerId={id} playerName={`${player.firstName} ${player.lastName}`} canManage={false} />
    </div>
  );
}
