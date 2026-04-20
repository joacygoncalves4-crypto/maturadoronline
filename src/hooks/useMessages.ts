import { useState, useEffect, useCallback } from "react";
import { 
  getMessages, 
  addMessage, 
  addMessagesBulk, 
  deleteMessage, 
  deleteAllMessages, 
  toggleMessage,
  getMessageStats,
  Message 
} from "@/lib/supabase";
import { toast } from "sonner";

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; categories: Record<string, number> }>({
    total: 0, active: 0, categories: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const [msgs, statsData] = await Promise.all([getMessages(), getMessageStats()]);
      setMessages(msgs);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleAddMessage = async (content: string, category: string = "geral") => {
    const result = await addMessage(content, category);
    if (result) {
      toast.success("Mensagem adicionada!");
      await loadMessages();
    } else {
      toast.error("Erro ao adicionar mensagem");
    }
  };

  const handleImportTxt = async (file: File) => {
    try {
      setIsImporting(true);
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length >= 2 && line.length <= 500); // Filter empty and too short/long

      if (lines.length === 0) {
        toast.error("Arquivo vazio ou sem mensagens válidas");
        return 0;
      }

      // Detect category from filename
      const fileName = file.name.toLowerCase();
      let defaultCategory = "geral";
      if (fileName.includes("saudacao") || fileName.includes("saudação")) defaultCategory = "saudacao";
      else if (fileName.includes("pergunta")) defaultCategory = "pergunta";
      else if (fileName.includes("plano")) defaultCategory = "plano";
      else if (fileName.includes("zoeira") || fileName.includes("humor")) defaultCategory = "zoeira";
      else if (fileName.includes("horario") || fileName.includes("horário")) defaultCategory = "horario";
      else if (fileName.includes("emoji")) defaultCategory = "emoji";
      else if (fileName.includes("resposta")) defaultCategory = "resposta";
      else if (fileName.includes("conversa")) defaultCategory = "conversa";

      // Import in batches of 100
      const batchSize = 100;
      let totalImported = 0;

      for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize).map(content => ({
          content,
          category: defaultCategory,
        }));
        const count = await addMessagesBulk(batch);
        totalImported += count;
      }

      toast.success(`${totalImported} mensagens importadas do arquivo "${file.name}"!`);
      await loadMessages();
      return totalImported;
    } catch (error: any) {
      console.error("Error importing file:", error);
      toast.error(error.message || "Erro ao importar arquivo");
      return 0;
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteMessage(id);
    if (success) {
      toast.success("Mensagem excluída");
      await loadMessages();
    } else {
      toast.error("Erro ao excluir");
    }
  };

  const handleDeleteAll = async () => {
    const success = await deleteAllMessages();
    if (success) {
      toast.success("Todas as mensagens excluídas");
      await loadMessages();
    } else {
      toast.error("Erro ao excluir mensagens");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const success = await toggleMessage(id, isActive);
    if (success) {
      await loadMessages();
    }
  };

  // Filtered messages
  const filteredMessages = messages.filter(msg => {
    const matchCategory = filter === "all" || msg.category === filter;
    const matchSearch = !searchQuery || msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const categories = Object.keys(stats.categories);

  return {
    messages: filteredMessages,
    allMessages: messages,
    stats,
    categories,
    isLoading,
    isImporting,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    addMessage: handleAddMessage,
    importTxt: handleImportTxt,
    deleteMessage: handleDelete,
    deleteAllMessages: handleDeleteAll,
    toggleMessage: handleToggle,
    reload: loadMessages,
  };
}
