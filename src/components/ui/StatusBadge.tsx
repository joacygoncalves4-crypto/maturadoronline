import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "connected" | "disconnected" | "connecting";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    connected: {
      label: "Conectado",
      className: "status-connected",
      dot: "bg-primary animate-pulse",
    },
    disconnected: {
      label: "Desconectado",
      className: "status-disconnected",
      dot: "bg-destructive",
    },
    connecting: {
      label: "Conectando...",
      className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
      dot: "bg-yellow-500 animate-pulse",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border",
      config.className,
      className
    )}>
      <span className={cn("w-2 h-2 rounded-full", config.dot)} />
      {config.label}
    </div>
  );
}
