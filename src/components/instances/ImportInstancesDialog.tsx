import { useState } from "react";
import { Download, Loader2, RefreshCw, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AvailableInstance {
  name: string;
  phoneNumber: string | null;
  status: string;
}

interface ImportInstancesDialogProps {
  fetchAvailable: () => Promise<AvailableInstance[]>;
  onImport: (selectedNames: string[]) => Promise<{ imported: number; skipped: number }>;
  isLoading?: boolean;
}

export function ImportInstancesDialog({
  fetchAvailable,
  onImport,
  isLoading,
}: ImportInstancesDialogProps) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableInstance[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);

  const loadAvailable = async () => {
    setFetching(true);
    try {
      const list = await fetchAvailable();
      setAvailable(list);
      // Pre-select all
      setSelected(new Set(list.map((i) => i.name)));
    } finally {
      setFetching(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadAvailable();
  };

  const toggleAll = () => {
    if (selected.size === available.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(available.map((i) => i.name)));
    }
  };

  const toggleOne = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    const result = await onImport(Array.from(selected));
    if (result.imported > 0) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
          <Download className="w-4 h-4 mr-2" />
          Importar da Evolution
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Instâncias Conectadas</DialogTitle>
          <DialogDescription>
            Selecione quais instâncias conectadas da Evolution importar para o projeto.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : available.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhuma instância conectada disponível para importar.
            </p>
            <p className="text-xs text-muted-foreground">
              Apenas instâncias com status <strong>conectado</strong> que ainda não estão no projeto aparecem aqui.
            </p>
            <Button variant="outline" size="sm" onClick={loadAvailable}>
              <RefreshCw className="w-3 h-3 mr-2" />
              Atualizar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selected.size === available.length ? "Desmarcar todas" : "Selecionar todas"}
              </button>
              <span className="text-xs text-muted-foreground">
                {selected.size} de {available.length} selecionadas
              </span>
            </div>

            <ScrollArea className="h-72 rounded-lg border border-border">
              <div className="p-2 space-y-1">
                {available.map((inst) => (
                  <label
                    key={inst.name}
                    className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(inst.name)}
                      onCheckedChange={() => toggleOne(inst.name)}
                    />
                    <Smartphone className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {inst.phoneNumber ? `+${inst.phoneNumber}` : "Sem número"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || selected.size === 0 || available.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Importar {selected.size > 0 ? `(${selected.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
