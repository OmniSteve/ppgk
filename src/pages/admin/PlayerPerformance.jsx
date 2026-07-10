import { useParams, useLocation, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PlayerPerformanceList from '@/components/performance/PlayerPerformanceList';

export default function AdminPlayerPerformance() {
  const { id } = useParams();
  const location = useLocation();
  const player = location.state?.player;
  const playerName = player ? `${player.firstName} ${player.lastName}` : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/admin/players" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors print:hidden">
        <ChevronLeft size={16} />Back to Players
      </Link>

      <div>
        <h1 className="text-2xl font-black text-foreground">{playerName || 'Player'} — Performance</h1>
        <p className="text-muted-foreground text-sm">Goalkeeper evaluation history and progress</p>
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
