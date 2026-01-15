import { Smartphone, RefreshCw, Trash2, QrCode, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Instance } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface InstanceCardProps {
  instance: Instance;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export function InstanceCard({
  instance,
  onConnect,
  onDisconnect,
  onRefresh,
  onDelete,
  isLoading,
}: InstanceCardProps) {
  const isConnected = instance.status === "open" || instance.status === "connected";
  const hasQrCode = !!instance.qr_code;

  return (
    <div className="glass-card-hover rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isConnected ? "bg-primary/20" : "bg-muted"
          )}>
            <Smartphone className={cn(
              "w-6 h-6",
              isConnected ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{instance.instance_name}</h3>
            <p className="text-sm text-muted-foreground">
              {instance.phone_number || "Aguardando conexão..."}
            </p>
          </div>
        </div>
        <StatusBadge 
          status={isConnected ? "connected" : hasQrCode ? "connecting" : "disconnected"} 
        />
      </div>

      {hasQrCode && !isConnected && (
        <div className="mb-4 flex justify-center">
          <div className="p-4 bg-white rounded-xl">
            <img 
              src={instance.qr_code!} 
              alt="QR Code" 
              className="w-48 h-48"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {isConnected ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDisconnect}
            className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Power className="w-4 h-4 mr-2" />
            Desconectar
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 border-primary/50 text-primary hover:bg-primary/10"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Conectar
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onRefresh}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onDelete}
          className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
