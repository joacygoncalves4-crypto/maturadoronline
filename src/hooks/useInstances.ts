import { useState, useEffect, useCallback } from "react";
import { 
  getInstances, 
  createInstance as createInstanceDb, 
  updateInstance, 
  deleteInstance as deleteInstanceDb,
  Instance 
} from "@/lib/supabase";
import { useSettings } from "./useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { settings, hasRequiredSettings } = useSettings();

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getInstances();
      setInstances(data);
    } catch (error) {
      console.error("Error loading instances:", error);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const createInstance = async (name: string) => {
    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API nas configurações primeiro");
      return;
    }

    try {
      setActionLoading("create");
      
      // Create in database first
      const dbInstance = await createInstanceDb(name);
      if (!dbInstance) {
        throw new Error("Failed to create instance in database");
      }

      // Call Evolution API via edge function
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "create",
          instanceName: name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      if (error) throw error;

      // Update instance with Evolution data
      await updateInstance(dbInstance.id, {
        instance_id: data.instance?.instanceName || name,
        qr_code: data.qrcode?.base64 ? `data:image/png;base64,${data.qrcode.base64}` : null,
        status: data.instance?.state || "connecting",
      });

      toast.success("Instância criada! Escaneie o QR Code.");
      await loadInstances();
    } catch (error: any) {
      console.error("Error creating instance:", error);
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setActionLoading(null);
    }
  };

  const connectInstance = async (instance: Instance) => {
    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API nas configurações primeiro");
      return;
    }

    try {
      setActionLoading(instance.id);

      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "connect",
          instanceName: instance.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      if (error) throw error;

      await updateInstance(instance.id, {
        qr_code: data.base64 ? `data:image/png;base64,${data.base64}` : null,
        status: "connecting",
      });

      toast.success("Escaneie o QR Code para conectar");
      await loadInstances();
    } catch (error: any) {
      console.error("Error connecting instance:", error);
      toast.error(error.message || "Erro ao conectar instância");
    } finally {
      setActionLoading(null);
    }
  };

  const disconnectInstance = async (instance: Instance) => {
    if (!hasRequiredSettings) return;

    try {
      setActionLoading(instance.id);

      const { error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "logout",
          instanceName: instance.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      if (error) throw error;

      await updateInstance(instance.id, {
        status: "disconnected",
        qr_code: null,
        phone_number: null,
      });

      toast.success("Instância desconectada");
      await loadInstances();
    } catch (error: any) {
      console.error("Error disconnecting instance:", error);
      toast.error(error.message || "Erro ao desconectar");
    } finally {
      setActionLoading(null);
    }
  };

  const refreshInstance = async (instance: Instance) => {
    if (!hasRequiredSettings) return;

    try {
      setActionLoading(instance.id);

      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "status",
          instanceName: instance.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      if (error) throw error;

      const isConnected = data.instance?.state === "open";
      
      await updateInstance(instance.id, {
        status: data.instance?.state || "disconnected",
        phone_number: isConnected ? data.instance?.owner?.split("@")[0] : null,
        qr_code: isConnected ? null : instance.qr_code,
      });

      toast.success(`Status: ${isConnected ? "Conectado" : "Desconectado"}`);
      await loadInstances();
    } catch (error: any) {
      console.error("Error refreshing instance:", error);
      toast.error(error.message || "Erro ao atualizar status");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteInstance = async (instance: Instance) => {
    try {
      setActionLoading(instance.id);

      // Try to delete from Evolution API first
      if (hasRequiredSettings) {
        try {
          await supabase.functions.invoke("evolution-proxy", {
            body: {
              action: "delete",
              instanceName: instance.instance_name,
              evolutionApiUrl: settings.evolutionApiUrl,
              evolutionApiKey: settings.evolutionApiKey,
            },
          });
        } catch (e) {
          console.warn("Could not delete from Evolution API:", e);
        }
      }

      // Delete from database
      await deleteInstanceDb(instance.id);

      toast.success("Instância excluída");
      await loadInstances();
    } catch (error: any) {
      console.error("Error deleting instance:", error);
      toast.error(error.message || "Erro ao excluir instância");
    } finally {
      setActionLoading(null);
    }
  };

  const activeInstances = instances.filter(
    (i) => i.status === "open" || i.status === "connected"
  );

  return {
    instances,
    activeInstances,
    isLoading,
    actionLoading,
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshInstance,
    deleteInstance,
    reload: loadInstances,
  };
}
