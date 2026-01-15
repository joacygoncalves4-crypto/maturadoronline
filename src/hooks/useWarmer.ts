import { useState, useEffect, useCallback, useRef } from "react";
import { 
  getSystemStatus, 
  updateSystemStatus, 
  getLogs, 
  createLog,
  SystemStatus,
  LogEntry,
  Instance
} from "@/lib/supabase";
import { useSettings } from "./useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWarmer(activeInstances: Instance[]) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { settings, hasRequiredSettings } = useSettings();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [status, logsData] = await Promise.all([
        getSystemStatus(),
        getLogs(100),
      ]);
      
      setSystemStatus(status);
      setLogs(logsData);
    } catch (error) {
      console.error("Error loading warmer data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to realtime logs
    const channel = supabase
      .channel("logs-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (payload) => {
          setLogs((prev) => [payload.new as LogEntry, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const generateMessage = async (): Promise<string> => {
    if (!settings.geminiApiToken) {
      // Fallback messages if no Gemini token
      const fallbackMessages = [
        "E aí, tudo certo? 👋",
        "Opa, beleza?",
        "Fala mano, suave?",
        "Iae, como tá?",
        "Tudo tranquilo por aí?",
        "E aí parceiro, firmeza?",
        "Salve! Tudo bem?",
        "Fala aí, como vai?",
      ];
      return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    }

    try {
      const { data, error } = await supabase.functions.invoke("gemini-generate", {
        body: {
          geminiApiToken: settings.geminiApiToken,
          prompt: "Gere uma mensagem casual, curta e humanizada de WhatsApp, usando gírias brasileiras leves, simulando um amigo falando com outro. Variações: Pergunta, afirmação ou comentário casual. Máximo 15 palavras. Não use aspas na resposta.",
        },
      });

      if (error) throw error;
      return data.message || "E aí, tudo certo?";
    } catch (error) {
      console.error("Error generating message:", error);
      return "E aí, tudo certo? 👋";
    }
  };

  const sendMessage = async (from: Instance, to: Instance, message: string) => {
    if (!hasRequiredSettings) return false;

    try {
      const { error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "sendText",
          instanceName: from.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
          data: {
            number: to.phone_number,
            text: message,
          },
        },
      });

      if (error) throw error;

      // Log the message
      await createLog({
        from_number: from.phone_number || from.instance_name,
        to_number: to.phone_number || to.instance_name,
        message_content: message,
        type: "message",
      });

      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  };

  const runWarmerCycle = useCallback(async () => {
    if (activeInstances.length < 2) {
      console.log("Not enough active instances for warming");
      return;
    }

    setIsRunning(true);

    try {
      // Select two random different instances
      const shuffled = [...activeInstances].sort(() => Math.random() - 0.5);
      const sender = shuffled[0];
      const receiver = shuffled[1];

      // Generate message
      const message = await generateMessage();

      // Send message
      const success = await sendMessage(sender, receiver, message);

      if (success) {
        // Update last execution
        await updateSystemStatus({ last_execution: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Warmer cycle error:", error);
    } finally {
      setIsRunning(false);
    }
  }, [activeInstances, settings, hasRequiredSettings]);

  const toggleSystem = async (active: boolean) => {
    try {
      await updateSystemStatus({ is_active: active });
      setSystemStatus((prev) => prev ? { ...prev, is_active: active } : null);
      
      if (active) {
        toast.success("Sistema de maturação ativado!");
      } else {
        toast.info("Sistema de maturação pausado");
      }
    } catch (error) {
      console.error("Error toggling system:", error);
      toast.error("Erro ao alterar status do sistema");
    }
  };

  const updateInterval = async (minutes: number) => {
    try {
      await updateSystemStatus({ interval_minutes: minutes });
      setSystemStatus((prev) => prev ? { ...prev, interval_minutes: minutes } : null);
    } catch (error) {
      console.error("Error updating interval:", error);
    }
  };

  // Warmer loop effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (systemStatus?.is_active && activeInstances.length >= 2 && hasRequiredSettings) {
      const intervalMs = (systemStatus.interval_minutes || 5) * 60 * 1000;
      
      // Run immediately on activation
      runWarmerCycle();
      
      intervalRef.current = setInterval(runWarmerCycle, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [systemStatus?.is_active, systemStatus?.interval_minutes, activeInstances.length, hasRequiredSettings, runWarmerCycle]);

  const todayLogs = logs.filter((log) => {
    const today = new Date();
    const logDate = new Date(log.created_at);
    return logDate.toDateString() === today.toDateString();
  });

  return {
    systemStatus,
    logs,
    todayLogs,
    isLoading,
    isRunning,
    toggleSystem,
    updateInterval,
    runManualCycle: runWarmerCycle,
    reload: loadData,
  };
}
