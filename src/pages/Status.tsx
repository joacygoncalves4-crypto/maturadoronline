import { useState, useRef, useEffect } from "react";
import { Upload, Image as ImageIcon, Loader2, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadMedia, addMedia, getMediaQueue, deleteMedia, MediaItem } from "@/lib/supabase";

const Status = () => {
  const [mediaQueue, setMediaQueue] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = async () => {
    try {
      setIsLoading(true);
      const data = await getMediaQueue();
      setMediaQueue(data);
    } catch (error) {
      console.error("Error loading media:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image or video
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error("Por favor, selecione apenas imagens ou vídeos.");
      return;
    }

    try {
      setIsUploading(true);
      toast.info("Fazendo upload da mídia...");
      
      const fileUrl = await uploadMedia(file);
      if (!fileUrl) throw new Error("Falha no upload");

      await addMedia(fileUrl, file.name);
      
      toast.success("Mídia adicionada na fila com sucesso!");
      await loadMedia();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da mídia.");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMedia(id);
      setMediaQueue(prev => prev.filter(item => item.id !== id));
      toast.success("Mídia removida da fila");
    } catch (error) {
      toast.error("Erro ao remover mídia");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Automação de Status</h1>
        <p className="text-muted-foreground mt-1">Poste stories em todos os chips</p>
      </div>

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
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          )}
          
          <p className="text-muted-foreground font-medium">
            {isUploading ? "Fazendo upload..." : "Clique para selecionar fotos ou vídeos"}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Adicione imagens ou vídeos curtos para postar no status do WhatsApp
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Fila de Postagem</h2>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : mediaQueue.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhuma mídia na fila</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mediaQueue.map((item) => (
              <div key={item.id} className="relative group rounded-xl overflow-hidden border border-border/50 aspect-square">
                <img 
                  src={item.file_url} 
                  alt={item.file_name || "Mídia"} 
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay actions */}
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
                
                {/* Status indicator */}
                {item.posted && (
                  <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full">
                    Postado
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
