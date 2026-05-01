import { useState, useRef, useEffect } from "react";
import { Upload, Image as ImageIcon, Loader2, Trash2, Send, Clock, Power, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  uploadMedia,
  addMedia,
  getMediaQueue,
  deleteMedia,
  MediaItem,
  getSystemStatus,
  updateSystemStatus,
  SystemStatus,
} from "@/lib/supabase";

const Status = () => {
  const [mediaQueue, setMediaQueue] = useState<MediaItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [media, status] = await Promise.all([getMediaQueue(), getSystemStatus()]);
      setMediaQueue(media);
      setSystemStatus(status);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Por favor, selecione apenas imagens ou vídeos.");
      return;
    }

    try {
      setIsUploading(true);
      toast.info("Fazendo upload da mídia...");

      const fileUrl = await uploadMedia(file);
      if (!fileUrl) throw new Error("Falha no upload");

      await addMedia(fileUrl, file.name);

      toast.success("Mídia adicionada na fila!");
      await loadAll();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da mídia.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMedia(id);
      setMediaQueue((prev) => prev.filter((item) => item.id !== id));
      toast.success("Mídia removida");
    } catch (error) {
      toast.error("Erro ao remover mídia");
    }
  };

  const toggleStatusPosting = async (enabled: boolean) => {
    try {
      await updateSystemStatus({ enable_status_posting: enabled });
      setSystemStatus((p) => (p ? { ...p, enable_status_posting: enabled } : null));
      toast.success(enabled ? "Postagem automática ATIVADA 🔥" : "Postagem automática pausada");
    } catch (e) {
      toast.error("Erro ao alterar status");
    }
  };

  const updateInterval = async (hours: number) => {
    try {
      await updateSystemStatus({ status_interval_hours: hours });
      setSystemStatus((p) => (p ? { ...p, status_interval_hours: hours } : null));
    } catch (e) {
      toast.error("Erro ao salvar intervalo");
    }
  };

  // Próximo post baseado em last_status_post + intervalo
  const getNextPostInfo = (): string => {
    if (!systemStatus?.enable_status_posting) return "Desativado";
    const intervalH = systemStatus.status_interval_hours || 6;
    if (!systemStatus.last_status_post) return "Em até 1 minuto (assim que ativar)";

    const last = new Date(systemStatus.last_status_post).getTime();
    const next = last + intervalH * 3600 * 1000;
    const now = Date.now();

    if (next <= now) return "A qualquer momento";
    const diffMin = Math.ceil((next - now) / 60000);
    if (diffMin < 60) return `Em ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `Em ${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Automação de Status</h1>
        <p className="text-muted-foreground mt-1">Postagem automática de stories nos chips</p>
      </div>

      {/* Card de configuração */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                systemStatus?.enable_status_posting ? "bg-primary/20 neon-glow" : "bg-muted"
              }`}
            >
              <Power
                className={`w-7 h-7 ${
                  systemStatus?.enable_status_posting ? "text-primary" : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Postagem Automática</h2>
              <p className="text-sm text-muted-foreground">
                {mediaQueue.length} mídia(s) na fila • Próximo: {getNextPostInfo()}
              </p>
            </div>
          </div>
          <Switch
            checked={systemStatus?.enable_status_posting || false}
            onCheckedChange={toggleStatusPosting}
            disabled={mediaQueue.length === 0}
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              Intervalo entre posts: {systemStatus?.status_interval_hours || 6}h
            </Label>
            <Slider
              value={[systemStatus?.status_interval_hours || 6]}
              onValueChange={([v]) => updateInterval(v)}
              min={1}
              max={24}
              step={1}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recomendado: 4-8h para parecer natural
            </p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="glass-card rounded-xl p-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,video/*"
          className="hidden"
        />
        <div
          className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
          ) : (
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          )}

          <p className="text-muted-foreground font-medium">
            {isUploading ? "Fazendo upload..." : "Clique para adicionar fotos ou vídeos"}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Aceita imagens (JPG, PNG) e vídeos curtos (MP4)
          </p>
        </div>
      </div>

      {/* Fila de mídia */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">
          Fila de Postagem ({mediaQueue.length})
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : mediaQueue.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhuma mídia na fila</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Faça upload acima para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mediaQueue.map((item) => (
              <div
                key={item.id}
                className="relative group rounded-xl overflow-hidden border border-border/50 aspect-square"
              >
                <img
                  src={item.file_url}
                  alt={item.file_name || "Mídia"}
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {item.posted && (
                  <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full">
                    ✓ Postado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Status;
