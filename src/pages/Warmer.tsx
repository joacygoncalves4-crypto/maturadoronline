import { Flame, Play, Clock, Shield, ArrowUpDown, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TerminalLog } from "@/components/ui/TerminalLog";
import { useInstances } from "@/hooks/useInstances";
import { useWarmer } from "@/hooks/useWarmer";
import { useMessages } from "@/hooks/useMessages";

const Warmer = () => {
  const { activeInstances } = useInstances();
  const { systemStatus, logs, isRunning, toggleSystem, updateInterval, updateAntibanSettings, runManualCycle } = useWarmer(activeInstances);
  const { stats: messageStats } = useMessages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Motor de Maturação</h1>
        <p className="text-muted-foreground mt-1">Controle o aquecimento dos chips</p>
      </div>

      {/* System Status */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${systemStatus?.is_active ? "bg-primary/20 neon-glow" : "bg-muted"}`}>
              <Flame className={`w-7 h-7 ${systemStatus?.is_active ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Status do Sistema</h2>
              <p className="text-sm text-muted-foreground">
                {activeInstances.length} chips ativos • {messageStats.active} mensagens no banco
              </p>
            </div>
          </div>
          <Switch checked={systemStatus?.is_active || false} onCheckedChange={toggleSystem} disabled={activeInstances.length < 2} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Intervalo entre mensagens: {systemStatus?.interval_minutes || 5} min</label>
            <Slider value={[systemStatus?.interval_minutes || 5]} onValueChange={([v]) => updateInterval(v)} min={3} max={30} step={1} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Recomendado: 5-15 min para evitar ban</p>
          </div>
          <Button onClick={runManualCycle} disabled={isRunning || activeInstances.length < 2} variant="outline" className="w-full">
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? "Executando..." : "Executar Ciclo Manual"}
          </Button>
        </div>
      </div>

      {/* Anti-Ban Settings */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Proteção Anti-Ban</h2>
            <p className="text-sm text-muted-foreground">Configurações de segurança para evitar bloqueio</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Active Hours */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30">
            <div className="flex items-center gap-2 shrink-0">
              <Sun className="w-4 h-4 text-yellow-400" />
              <Label className="shrink-0">Horário ativo:</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={systemStatus?.start_hour ?? 8}
                onChange={(e) => updateAntibanSettings({ start_hour: parseInt(e.target.value) || 8 })}
                className="w-20 bg-input text-center"
              />
              <span className="text-muted-foreground">h até</span>
              <Input
                type="number"
                min={0}
                max={23}
                value={systemStatus?.end_hour ?? 22}
                onChange={(e) => updateAntibanSettings({ end_hour: parseInt(e.target.value) || 22 })}
                className="w-20 bg-input text-center"
              />
              <span className="text-muted-foreground">h</span>
              <Moon className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          {/* Daily Limit */}
          <div className="p-4 rounded-lg bg-card/60 border border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <Label>Limite diário por chip: {systemStatus?.daily_limit_per_chip ?? 40} msgs</Label>
              </div>
            </div>
            <Slider 
              value={[systemStatus?.daily_limit_per_chip ?? 40]} 
              onValueChange={([v]) => updateAntibanSettings({ daily_limit_per_chip: v })} 
              min={5} max={100} step={5} 
              className="mt-3" 
            />
            <p className="text-xs text-muted-foreground mt-2">
              ⚡ Rampa gradual automática: Semana 1 = máx 10/dia → Semana 4 = limite total
            </p>
          </div>

          {/* Bidirectional */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-card/60 border border-border/30">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-primary" />
              <div>
                <Label>Conversa bidirecional</Label>
                <p className="text-xs text-muted-foreground">A → B, depois B → A (simula conversa real)</p>
              </div>
            </div>
            <Switch 
              checked={systemStatus?.enable_bidirectional ?? true} 
              onCheckedChange={(v) => updateAntibanSettings({ enable_bidirectional: v })} 
            />
          </div>
        </div>
      </div>

      {/* Cron 24/7 Info */}
      <div className="glass-card rounded-xl p-5 border-primary/20">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Modo 24/7 (Backend Cron)
        </h3>
        <p className="text-sm text-muted-foreground">
          O maturador roda automaticamente no servidor via <strong>Edge Function</strong>, 
          mesmo com o navegador fechado. O loop do frontend serve apenas como backup.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Para ativar o cron no Supabase, acesse o Dashboard → Edge Functions → 
          <code className="bg-muted px-1.5 py-0.5 rounded mx-1">warmer-cron</code> 
          e configure um schedule (ex: a cada 5 minutos).
        </p>
      </div>

      {/* Logs */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Terminal de Logs</h2>
        <TerminalLog logs={logs} maxHeight="400px" />
      </div>
    </div>
  );
};

export default Warmer;
