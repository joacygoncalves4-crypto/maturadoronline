import { Loader2, RefreshCw } from "lucide-react";
import { InstanceCard } from "@/components/instances/InstanceCard";
import { CreateInstanceDialog } from "@/components/instances/CreateInstanceDialog";
import { useInstances } from "@/hooks/useInstances";
import { Button } from "@/components/ui/button";

const Instances = () => {
  const {
    instances,
    isLoading,
    actionLoading,
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshInstance,
    deleteInstance,
    syncAllNumbers,
  } = useInstances();

  const isSyncing = actionLoading === "sync";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text">Instâncias</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus chips de WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={syncAllNumbers}
            disabled={isSyncing || instances.length === 0}
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar Números
          </Button>
          <CreateInstanceDialog onCreateInstance={createInstance} isLoading={actionLoading === "create"} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : instances.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Nenhuma instância criada ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Nova Instância" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onConnect={() => connectInstance(instance)}
              onDisconnect={() => disconnectInstance(instance)}
              onRefresh={() => refreshInstance(instance)}
              onDelete={() => deleteInstance(instance)}
              isLoading={actionLoading === instance.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Instances;
