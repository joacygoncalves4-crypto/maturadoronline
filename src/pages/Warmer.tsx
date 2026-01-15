import { Flame, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TerminalLog } from "@/components/ui/TerminalLog";
import { useInstances } from "@/hooks/useInstances";
import { useWarmer } from "@/hooks/useWarmer";

const Warmer = () => {
  const { activeInstances } = useInstances();
  const { systemStatus, logs, isRunning, toggleSystem, updateInterval, runManualCycle } = useWarmer(activeInstances);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Motor de Maturação</h1>
        <p className="text-muted-foreground mt-1">Controle o aquecimento dos chips</p>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${systemStatus?.is_active ? "bg-primary/20 neon-glow" : "bg-muted"}`}>
              <Flame className={`w-7 h-7 ${systemStatus?.is_active ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Status do Sistema</h2>
              <p className="text-sm text-muted-foreground">{activeInstances.length} chips ativos disponíveis</p>
            </div>
          </div>
          <Switch checked={systemStatus?.is_active || false} onCheckedChange={toggleSystem} disabled={activeInstances.length < 2} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Intervalo entre mensagens: {systemStatus?.interval_minutes || 5} min</label>
            <Slider value={[systemStatus?.interval_minutes || 5]} onValueChange={([v]) => updateInterval(v)} min={1} max={10} step={1} className="mt-2" />
          </div>
          <Button onClick={runManualCycle} disabled={isRunning || activeInstances.length < 2} variant="outline" className="w-full">
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? "Executando..." : "Executar Ciclo Manual"}
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Terminal de Logs</h2>
        <TerminalLog logs={logs} maxHeight="400px" />
      </div>
    </div>
  );
};

export default Warmer;
