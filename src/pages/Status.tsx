import { Upload, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Status = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Automação de Status</h1>
        <p className="text-muted-foreground mt-1">Poste stories em todos os chips</p>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Arraste imagens aqui ou clique para fazer upload</p>
          <Button variant="outline" className="mt-4">
            <Upload className="w-4 h-4 mr-2" />
            Selecionar Arquivos
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 text-center">
        <p className="text-muted-foreground">Nenhuma mídia na fila</p>
      </div>
    </div>
  );
};

export default Status;
