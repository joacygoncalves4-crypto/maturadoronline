import { useState, useEffect, useCallback, useRef } from "react";
import { 
  getSystemStatus, 
  updateSystemStatus, 
  getLogs, 
  createLog,
  getActiveMessages,
  updateInstance,
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
    // Priority 1: Get message from database bank
    try {
      const messages = await getActiveMessages();
      if (messages.length > 0) {
        // Pick from least-used messages for variety
        const leastUsedCount = messages[0].used_count || 0;
        const leastUsed = messages.filter(m => (m.used_count || 0) <= leastUsedCount + 2);
        const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)];

        // Update usage counter
        await supabase
          .from('messages')
          .update({ 
            used_count: (chosen.used_count || 0) + 1,
            last_used_at: new Date().toISOString() 
          })
          .eq('id', chosen.id);

        return chosen.content;
      }
    } catch (error) {
      console.error("Error fetching messages from bank:", error);
    }

    // Priority 2: Gemini AI (fallback if API token is set)
    if (settings.geminiApiToken) {
      try {
        const { data, error } = await supabase.functions.invoke("gemini-generate", {
          body: {
            geminiApiToken: settings.geminiApiToken,
            prompt: `Gere UMA mensagem casual e curta de WhatsApp em português brasileiro.
Use gírias leves como: "mano", "cara", "beleza", "suave", "tmj", "kkk".
Simule um amigo falando com outro de forma natural.
Variações possíveis: pergunta casual, saudação, comentário sobre futebol, planos.
MÁXIMO 12 palavras. NÃO use aspas. Seja criativo e varie o estilo.`,
          },
        });

        if (error) throw error;
        
        const message = data?.message?.trim();
        if (message && message.length > 3 && message.length < 100) {
          return message.replace(/^["']|["']$/g, '');
        }
      } catch (error) {
        console.error("Error generating message via Gemini:", error);
      }
    }

    // Priority 3: Hardcoded fallback (emergency only)
    const fallbackMessages = [
      "E aí mano, suave? 👊",
      "Fala aí parceiro, tudo certo?",
      "Opa, beleza? Quanto tempo!",
      "Salve! Tá firmeza?",
      "Iae cara, como tão as coisas?",
      "E aí, vai rolar aquele futebol?",
      "Fala aí, sumido! Tudo bem?",
      "Opa, tava pensando em você!",
      "Eai, viu o jogo ontem?",
      "Fala man, tá precisando de algo?",
      "Tmj! Passa lá em casa qualquer hora",
      "Kkk lembrei de você agora",
      "Po mano, saudade! Bora marcar algo",
      "E aí chefe, como tá a família?",
      "Opa, tranquilo por aí?",
    ];

    return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
  };

  const sendMessage = async (from: Instance, to: Instance, message: string): Promise<boolean> => {
    if (!hasRequiredSettings) {
      console.error("Missing required settings");
      return false;
    }

    if (!to.phone_number) {
      console.error("Recipient has no phone number");
      return false;
    }

    try {
      console.log(`Sending message from ${from.instance_name} to ${to.phone_number}: "${message}"`);

      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "sendText",
          instanceName: from.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
          data: {
            number: to.phone_number,
            text: message,
            delay: 3000 + Math.random() * 5000, // Humanized delay 3-8s
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log("Message sent successfully:", data);

      // Log the message
      await createLog({
        from_number: from.phone_number || from.instance_name,
        to_number: to.phone_number || to.instance_name,
        message_content: message,
        type: "message",
      });

      return true;
    } catch (error: any) {
      console.error("Error sending message:", error);

      const errorMessage = error?.message || "Falha no envio";
      const isMissingInstance = errorMessage.includes("Not Found") || errorMessage.includes("does not exist");

      if (isMissingInstance) {
        await Promise.allSettled([
          updateInstance(from.id, {
            status: "disconnected",
            phone_number: null,
            qr_code: null,
            is_warmer_enabled: false,
          }),
          createLog({
            from_number: from.phone_number || from.instance_name,
            to_number: to.phone_number || to.instance_name,
            message_content: `[ERRO] Instância removida da Evolution: ${from.instance_name}`,
            type: "error",
          }),
        ]);

        toast.error(`${from.instance_name} não existe mais na Evolution e foi removida do maturador`);
        return false;
      }
      
      // Log the error
      await createLog({
        from_number: from.phone_number || from.instance_name,
        to_number: to.phone_number || to.instance_name,
        message_content: `[ERRO] ${errorMessage}`,
        type: "error",
      });

      return false;
    }
  };

  const runWarmerCycle = useCallback(async () => {
    // Manual trigger: just invoke the backend cron with force=true.
    // The backend owns ALL the logic (rotation, cooldowns, sending).
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("warmer-cron", {
        body: { force: true },
      });
      if (error) throw error;
      if (data?.status === "success") {
        toast.success(`Mensagem enviada: ${data.sender} → ${data.receiver}`);
      } else if (data?.status === "send_failed") {
        toast.error(`Falha no envio: ${data.error}`);
      } else if (data?.status === "paused") {
        toast.info("Sistema está pausado. Ative primeiro.");
      } else if (data?.status === "sleeping") {
        toast.info(`Fora do horário ativo (${data.hour}h BRT)`);
      } else if (data?.status === "insufficient_instances") {
        toast.error("Precisa de pelo menos 2 chips ativos no maturador");
      } else if (data?.status === "daily_limit_reached") {
        toast.info("Limite diário atingido para todos os chips");
      } else {
        toast.info(`Status: ${data?.status || "ok"}`);
      }
      await loadData();
    } catch (error: any) {
      console.error("Manual cycle error:", error);
      toast.error("Erro ao executar ciclo manual");
    } finally {
      setIsRunning(false);
    }
  }, [loadData]);

  const toggleSystem = async (active: boolean) => {
    if (active && activeInstances.length < 2) {
      toast.error("Conecte pelo menos 2 chips antes de ativar");
      return;
    }

    if (active && !hasRequiredSettings) {
      toast.error("Configure a Evolution API primeiro");
      return;
    }

    try {
      await updateSystemStatus({ is_active: active });
      setSystemStatus((prev) => prev ? { ...prev, is_active: active } : null);
      
      if (active) {
        // Also trigger the cron function to start immediately
        try {
          await supabase.functions.invoke("warmer-cron", { body: {} });
        } catch (e) {
          console.log("Cron trigger (optional):", e);
        }
        toast.success("Sistema de maturação ATIVADO! 🔥");
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
      toast.success(`Intervalo alterado para ${minutes} minutos`);
    } catch (error) {
      console.error("Error updating interval:", error);
    }
  };

  const updateAntibanSettings = async (updates: Partial<SystemStatus>) => {
    try {
      await updateSystemStatus(updates);
      setSystemStatus((prev) => prev ? { ...prev, ...updates } : null);
      toast.success("Configurações anti-ban atualizadas");
    } catch (error) {
      console.error("Error updating anti-ban settings:", error);
    }
  };

  // NOTE: Warming runs 100% on the backend via pg_cron (warmer-cron edge function).
  // The browser is ONLY a viewer. We do NOT trigger cycles here so that closing the
  // tab has no effect on warming, and so we don't double-fire with the cron.
  // Manual cycle remains available via the "Run Now" button (runManualCycle).
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const todayLogs = logs.filter((log) => {
    const today = new Date();
    const logDate = new Date(log.created_at);
    return logDate.toDateString() === today.toDateString();
  });

  const messageLogs = logs.filter(log => log.type === "message");
  const errorLogs = logs.filter(log => log.type === "error");

  return {
    systemStatus,
    logs,
    todayLogs,
    messageLogs,
    errorLogs,
    isLoading,
    isRunning,
    toggleSystem,
    updateInterval,
    updateAntibanSettings,
    runManualCycle: runWarmerCycle,
    reload: loadData,
  };
}
