import { Smartphone, RefreshCw, Trash2, QrCode, Power, Loader2 } from "lucide-react";
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
  const isConnecting = instance.status === "connecting";
  const hasQrCode = !!instance.qr_code;

  const getStatusType = (): "connected" | "disconnected" | "connecting" => {
    if (isConnected) return "connected";
    if (isConnecting || hasQrCode) return "connecting";
    return "disconnected";
  };

  return (
    <div className="glass-card-hover rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
            isConnected ? "bg-primary/20 neon-glow" : isConnecting ? "bg-yellow-500/20" : "bg-muted"
          )}>
            <Smartphone className={cn(
              "w-6 h-6",
              isConnected ? "text-primary" : isConnecting ? "text-yellow-500" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{instance.instance_name}</h3>
            <p className="text-sm text-muted-foreground">
              {instance.phone_number ? `+${instance.phone_number}` : "Aguardando conexão..."}
            </p>
          </div>
        </div>
        <StatusBadge status={getStatusType()} />
      </div>

      {/* QR Code Display */}
      {hasQrCode && !isConnected && (
        <div className="mb-4">
          <div className="flex justify-center p-4 bg-white rounded-xl">
            <img 
              src={instance.qr_code!} 
              alt="QR Code para conexão" 
              className="w-52 h-52 object-contain"
              onError={(e) => {
                console.error("QR Code image error");
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Escaneie com WhatsApp → Dispositivos Vinculados
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4 mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Processando...</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {isConnected ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDisconnect}
            disabled={isLoading}
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
            {hasQrCode ? "Novo QR" : "Conectar"}
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onRefresh}
          disabled={isLoading}
          className="shrink-0"
          title="Atualizar status"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onDelete}
          disabled={isLoading}
          className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
          title="Excluir instância"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
