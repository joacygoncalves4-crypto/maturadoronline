import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { LogEntry } from "@/lib/supabase";
import { format } from "date-fns";

interface TerminalLogProps {
  logs: LogEntry[];
  className?: string;
  maxHeight?: string;
}

export function TerminalLog({ logs, className, maxHeight = "400px" }: TerminalLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "HH:mm:ss");
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case "message":
        return "text-primary";
      case "status":
        return "text-blue-400";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "terminal-log overflow-y-auto scrollbar-thin",
        className
      )}
      style={{ maxHeight }}
    >
      {logs.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">
          <p>Nenhum log ainda...</p>
          <p className="text-xs mt-1">As mensagens aparecerão aqui em tempo real</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-muted-foreground shrink-0">
                [{formatTime(log.created_at)}]
              </span>
              <span className={cn("shrink-0", getLogColor(log.type))}>
                {log.from_number}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground shrink-0">
                {log.to_number}:
              </span>
              <span className="text-foreground/80 break-all">
                "{log.message_content}"
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
