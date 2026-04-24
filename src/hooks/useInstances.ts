import { useState, useEffect, useCallback, useRef } from "react";
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadInstances]);

  // Poll for status updates on connecting instances
  useEffect(() => {
    const connectingInstances = instances.filter(i => i.status === "connecting" && i.qr_code);
    
    if (connectingInstances.length > 0 && hasRequiredSettings) {
      pollingRef.current = setInterval(async () => {
        for (const instance of connectingInstances) {
          try {
            const { data } = await supabase.functions.invoke("evolution-proxy", {
              body: {
                action: "status",
                instanceName: instance.instance_name,
                evolutionApiUrl: settings.evolutionApiUrl,
                evolutionApiKey: settings.evolutionApiKey,
              },
            });

            if (data?.instance?.state === "open") {
              await updateInstance(instance.id, {
                status: "open",
                phone_number: data.instance?.owner?.split("@")[0] || null,
                qr_code: null,
              });
              toast.success(`${instance.instance_name} conectado!`);
              loadInstances();
            }
          } catch (e) {
            console.warn("Polling error:", e);
          }
        }
      }, 5000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [instances, hasRequiredSettings, settings]);

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
        throw new Error("Falha ao criar instância no banco");
      }

      console.log("Creating instance in Evolution API:", name);

      // Call Evolution API via edge function
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "create",
          instanceName: name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      console.log("Evolution API response:", data);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Extract QR code from response - Evolution API v2 format
      let qrCodeBase64 = null;
      
      if (data?.qrcode?.base64) {
        qrCodeBase64 = data.qrcode.base64;
      } else if (data?.base64) {
        qrCodeBase64 = data.base64;
      } else if (typeof data?.qrcode === "string") {
        qrCodeBase64 = data.qrcode;
      }

      // Make sure base64 has proper data URI prefix
      if (qrCodeBase64 && !qrCodeBase64.startsWith("data:")) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      // Update instance with Evolution data
      await updateInstance(dbInstance.id, {
        instance_id: data?.instance?.instanceName || data?.instanceName || name,
        qr_code: qrCodeBase64,
        status: qrCodeBase64 ? "connecting" : (data?.instance?.state || "created"),
      });

      if (qrCodeBase64) {
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else {
        toast.success("Instância criada! Clique em Conectar para gerar o QR Code.");
      }
      
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

      console.log("Connect response:", data);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Extract QR code
      let qrCodeBase64 = null;
      
      if (data?.qrcode?.base64) {
        qrCodeBase64 = data.qrcode.base64;
      } else if (data?.base64) {
        qrCodeBase64 = data.base64;
      } else if (typeof data?.qrcode === "string") {
        qrCodeBase64 = data.qrcode;
      } else if (data?.code) {
        // Some versions return code instead of qrcode
        qrCodeBase64 = data.code;
      }

      if (qrCodeBase64 && !qrCodeBase64.startsWith("data:")) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      await updateInstance(instance.id, {
        qr_code: qrCodeBase64,
        status: "connecting",
      });

      if (qrCodeBase64) {
        toast.success("Escaneie o QR Code para conectar");
      } else {
        toast.info("Aguardando QR Code...");
      }
      
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

      await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "logout",
          instanceName: instance.instance_name,
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

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

      console.log("Status response:", data);

      if (error) throw error;

      const state = data?.instance?.state || data?.state || "disconnected";
      const isConnected = state === "open";
      
      await updateInstance(instance.id, {
        status: state,
        phone_number: isConnected ? (data?.instance?.owner?.split("@")[0] || null) : null,
        qr_code: isConnected ? null : instance.qr_code,
      });

      toast.success(`Status: ${isConnected ? "Conectado ✓" : state}`);
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

  // Sync all phone numbers from Evolution API
  const syncAllNumbers = async () => {
    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API nas configurações primeiro");
      return;
    }

    try {
      setActionLoading("sync");
      
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "fetchInstances",
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      console.log("Sync response:", data);
      
      if (error) throw error;

      // Evolution API v2 returns different formats depending on version
      // Format 1: [{ instance: { instanceName, owner }, ... }]
      // Format 2: [{ name, ownerJid, connectionStatus }]
      const evoInstances = Array.isArray(data) ? data : [];
      let updated = 0;
      
      console.log("Evolution instances found:", evoInstances.length);
      console.log("Raw first instance:", JSON.stringify(evoInstances[0])?.slice(0, 500));
      
      for (const raw of evoInstances) {
        // Normalize: handle both Evolution API v2 response formats
        const instanceData = raw.instance || raw;
        const name = instanceData.instanceName || instanceData.name || raw.name;
        const owner = instanceData.owner || raw.ownerJid || raw.owner;
        const connectionStatus = instanceData.state || instanceData.connectionStatus || raw.connectionStatus;
        
        console.log("Processing Evolution instance:", { name, owner, connectionStatus });
        
        // Match by instance_name (case-insensitive)
        const localInstance = instances.find(
          i => i.instance_id === name || 
               i.instance_name === name ||
               i.instance_name.toLowerCase() === name?.toLowerCase()
        );
        
        if (localInstance) {
          console.log("Found local match:", localInstance.instance_name);
          
          // Extract phone number from owner/ownerJid (format: "5511999999999@s.whatsapp.net" or just the number)
          let phoneNumber: string | null = null;
          if (owner) {
            phoneNumber = owner.includes("@") ? owner.split("@")[0] : owner;
          }
          
          console.log("Extracted:", { phoneNumber, connectionStatus });
          
          if (phoneNumber || connectionStatus) {
            await updateInstance(localInstance.id, {
              phone_number: phoneNumber || localInstance.phone_number,
              status: connectionStatus === "open" ? "open" : 
                      connectionStatus === "close" ? "disconnected" : localInstance.status,
            });
            updated++;
          }
        } else {
          console.log("No local match for:", name);
        }
      }

      await loadInstances();
      toast.success(`${updated} instância(s) sincronizada(s)`);
    } catch (error: any) {
      console.error("Error syncing numbers:", error);
      toast.error(error.message || "Erro ao sincronizar números");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle warmer participation for a specific instance
  const toggleWarmerEnabled = async (instance: Instance, enabled: boolean) => {
    try {
      // Optimistic update
      setInstances((prev) =>
        prev.map((i) => (i.id === instance.id ? { ...i, is_warmer_enabled: enabled } : i))
      );
      await updateInstance(instance.id, { is_warmer_enabled: enabled });
      toast.success(enabled ? "Incluído no maturador" : "Removido do maturador");
    } catch (error: any) {
      console.error("Error toggling warmer:", error);
      toast.error("Erro ao atualizar");
      await loadInstances();
    }
  };

  // Import all CONNECTED instances from Evolution API that aren't local yet
  const importFromEvolution = async (selectedNames?: string[]) => {
    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API nas configurações primeiro");
      return { imported: 0, skipped: 0 };
    }

    try {
      setActionLoading("import");

      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "fetchInstances",
          evolutionApiUrl: settings.evolutionApiUrl,
          evolutionApiKey: settings.evolutionApiKey,
        },
      });

      if (error) throw error;
      const evoInstances = Array.isArray(data) ? data : [];

      const existingNames = new Set(
        instances.map((i) => i.instance_name.toLowerCase())
      );

      let imported = 0;
      let skipped = 0;

      for (const raw of evoInstances) {
        const instanceData = raw.instance || raw;
        const name = instanceData.instanceName || instanceData.name || raw.name;
        const owner = instanceData.owner || raw.ownerJid || raw.owner;
        const connectionStatus =
          instanceData.state || instanceData.connectionStatus || raw.connectionStatus;

        if (!name) continue;
        // Only import CONNECTED instances
        if (connectionStatus !== "open") {
          skipped++;
          continue;
        }
        // Optional filter by user selection
        if (selectedNames && !selectedNames.includes(name)) continue;
        // Skip already-imported
        if (existingNames.has(name.toLowerCase())) {
          skipped++;
          continue;
        }

        const phoneNumber = owner ? (owner.includes("@") ? owner.split("@")[0] : owner) : null;

        const { error: insertError } = await supabase.from("instances").insert({
          instance_name: name,
          instance_id: name,
          status: "open",
          phone_number: phoneNumber,
          warming_start_date: new Date().toISOString().split("T")[0],
          is_warmer_enabled: true,
        });

        if (!insertError) imported++;
      }

      await loadInstances();
      if (imported > 0) {
        toast.success(`${imported} instância(s) importada(s)`);
      } else {
        toast.info("Nenhuma instância nova para importar");
      }
      return { imported, skipped };
    } catch (error: any) {
      console.error("Error importing from Evolution:", error);
      toast.error(error.message || "Erro ao importar instâncias");
      return { imported: 0, skipped: 0 };
    } finally {
      setActionLoading(null);
    }
  };

  // Fetch CONNECTED instances available to import (not yet local)
  const fetchAvailableToImport = async (): Promise<
    { name: string; phoneNumber: string | null; status: string }[]
  > => {
    if (!hasRequiredSettings) {
      toast.error("Configure a Evolution API nas configurações primeiro");
      return [];
    }
    const { data, error } = await supabase.functions.invoke("evolution-proxy", {
      body: {
        action: "fetchInstances",
        evolutionApiUrl: settings.evolutionApiUrl,
        evolutionApiKey: settings.evolutionApiKey,
      },
    });
    if (error) {
      toast.error("Erro ao buscar instâncias");
      return [];
    }
    const evoInstances = Array.isArray(data) ? data : [];
    const existingNames = new Set(instances.map((i) => i.instance_name.toLowerCase()));
    const available: { name: string; phoneNumber: string | null; status: string }[] = [];
    for (const raw of evoInstances) {
      const instanceData = raw.instance || raw;
      const name = instanceData.instanceName || instanceData.name || raw.name;
      const owner = instanceData.owner || raw.ownerJid || raw.owner;
      const connectionStatus =
        instanceData.state || instanceData.connectionStatus || raw.connectionStatus;
      if (!name || connectionStatus !== "open") continue;
      if (existingNames.has(name.toLowerCase())) continue;
      const phoneNumber = owner ? (owner.includes("@") ? owner.split("@")[0] : owner) : null;
      available.push({ name, phoneNumber, status: connectionStatus });
    }
    return available;
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
    syncAllNumbers,
    toggleWarmerEnabled,
    importFromEvolution,
    fetchAvailableToImport,
    reload: loadInstances,
  };
}
