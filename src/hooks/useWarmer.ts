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
    // Fallback messages if no Gemini token or if API fails
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

    if (!settings.geminiApiToken) {
      return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    }

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
        return message.replace(/^["']|["']$/g, ''); // Remove quotes if present
      }
      
      return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    } catch (error) {
      console.error("Error generating message:", error);
      return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    }
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
            delay: 1000 + Math.random() * 2000, // Random delay 1-3s for humanization
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
      
      // Log the error
      await createLog({
        from_number: from.phone_number || from.instance_name,
        to_number: to.phone_number || to.instance_name,
        message_content: `[ERRO] ${error.message || "Falha no envio"}`,
        type: "error",
      });

      return false;
    }
  };

  const runWarmerCycle = useCallback(async () => {
    if (activeInstances.length < 2) {
      console.log("Not enough active instances for warming (need at least 2)");
      toast.error("Precisa de pelo menos 2 chips conectados para maturação");
      return;
    }

    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API primeiro");
      return;
    }

    setIsRunning(true);

    try {
      // Select two random different instances
      const shuffled = [...activeInstances].sort(() => Math.random() - 0.5);
      const sender = shuffled[0];
      const receiver = shuffled[1];

      if (!sender.phone_number || !receiver.phone_number) {
        console.error("Instances don't have phone numbers");
        toast.error("As instâncias precisam estar conectadas com número de telefone");
        return;
      }

      console.log(`Warmer cycle: ${sender.instance_name} -> ${receiver.instance_name}`);

      // Generate message
      const message = await generateMessage();
      console.log(`Generated message: "${message}"`);

      // Send message
      const success = await sendMessage(sender, receiver, message);

      if (success) {
        // Update last execution
        await updateSystemStatus({ last_execution: new Date().toISOString() });
        toast.success(`Mensagem enviada: ${sender.phone_number} → ${receiver.phone_number}`);
      } else {
        toast.error("Falha ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Warmer cycle error:", error);
      toast.error("Erro no ciclo de maturação");
    } finally {
      setIsRunning(false);
    }
  }, [activeInstances, settings, hasRequiredSettings]);

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

  // Warmer loop effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (systemStatus?.is_active && activeInstances.length >= 2 && hasRequiredSettings) {
      const intervalMs = (systemStatus.interval_minutes || 5) * 60 * 1000;
      
      console.log(`Warmer activated: running every ${systemStatus.interval_minutes} minutes`);
      
      // Run immediately on activation
      runWarmerCycle();
      
      intervalRef.current = setInterval(() => {
        console.log("Warmer interval triggered");
        runWarmerCycle();
      }, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [systemStatus?.is_active, systemStatus?.interval_minutes, activeInstances.length, hasRequiredSettings]);

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
    runManualCycle: runWarmerCycle,
    reload: loadData,
  };
}
