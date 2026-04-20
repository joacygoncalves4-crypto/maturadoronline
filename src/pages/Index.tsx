import { MessageSquare, Smartphone, Zap, Clock, FileText } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { TerminalLog } from "@/components/ui/TerminalLog";
import { useInstances } from "@/hooks/useInstances";
import { useWarmer } from "@/hooks/useWarmer";
import { useMessages } from "@/hooks/useMessages";

const Dashboard = () => {
  const { instances, activeInstances } = useInstances();
  const { logs, todayLogs, systemStatus } = useWarmer(activeInstances);
  const { stats: messageStats } = useMessages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema de maturação</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Mensagens Trocadas"
          value={logs.length}
          icon={<MessageSquare className="w-6 h-6 text-primary" />}
        />
        <MetricCard
          title="Chips Ativos"
          value={`${activeInstances.length}/${instances.length}`}
          icon={<Smartphone className="w-6 h-6 text-primary" />}
        />
        <MetricCard
          title="Disparos Hoje"
          value={todayLogs.length}
          icon={<Zap className="w-6 h-6 text-primary" />}
        />
        <MetricCard
          title="Banco de Msgs"
          value={messageStats.active}
          icon={<FileText className="w-6 h-6 text-primary" />}
        />
        <MetricCard
          title="Status"
          value={systemStatus?.is_active ? "Ativo 🔥" : "Pausado"}
          icon={<Clock className="w-6 h-6 text-primary" />}
        />
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Log de Atividades</h2>
        <TerminalLog logs={logs} maxHeight="350px" />
      </div>
    </div>
  );
};

export default Dashboard;
