import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PlayerPerformanceList from '@/components/performance/PlayerPerformanceList';

export default function CoachPlayerPerformance() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const player = location.state?.player;
  const playerName = player ? `${player.firstName} ${player.lastName}` : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back
      </button>

      <div>
        <h1 className="text-2xl font-black text-white">{playerName || 'Player'} — Performance</h1>
        <p className="text-slate-400 text-sm">Goalkeeper evaluation history and progress</p>
      </div>

      <PlayerPerformanceList
        playerId={id}
        clientId={player?.clientId}
        playerName={playerName}
        canManage
      />
    </div>
  );
}
