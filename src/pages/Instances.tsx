import { Loader2 } from "lucide-react";
import { InstanceCard } from "@/components/instances/InstanceCard";
import { CreateInstanceDialog } from "@/components/instances/CreateInstanceDialog";
import { useInstances } from "@/hooks/useInstances";

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
  } = useInstances();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text">Instâncias</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus chips de WhatsApp</p>
        </div>
        <CreateInstanceDialog onCreateInstance={createInstance} isLoading={actionLoading === "create"} />
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
