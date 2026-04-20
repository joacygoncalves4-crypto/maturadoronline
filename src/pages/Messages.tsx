import { useState, useRef } from "react";
import { 
  Upload, FileText, Trash2, Search, Plus, Loader2, 
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2,
  MessageSquare, Tag, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/hooks/useMessages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  saudacao: "Saudação",
  pergunta: "Pergunta",
  plano: "Plano/Convite",
  zoeira: "Zoeira/Humor",
  horario: "Bom dia/Boa noite",
  emoji: "Emoji/Figurinha",
  resposta: "Resposta Curta",
  conversa: "Conversa Natural",
};

const CATEGORY_COLORS: Record<string, string> = {
  geral: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  saudacao: "bg-green-500/20 text-green-400 border-green-500/30",
  pergunta: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  plano: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  zoeira: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  horario: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  emoji: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  resposta: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  conversa: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const Messages = () => {
  const {
    messages,
    stats,
    categories,
    isLoading,
    isImporting,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    addMessage,
    importTxt,
    deleteMessage,
    deleteAllMessages,
    toggleMessage,
  } = useMessages();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("geral");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.txt')) {
      return;
    }

    await importTxt(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;
    await addMessage(newMessage.trim(), newCategory);
    setNewMessage("");
    setAddDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Banco de Mensagens</h1>
        <p className="text-muted-foreground mt-1">Gerencie as mensagens que serão enviadas durante a maturação</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Mensagens</p>
              <p className="text-2xl font-bold neon-text">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensagens Ativas</p>
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Tag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categorias</p>
              <p className="text-2xl font-bold text-blue-400">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Distribuição por Categoria</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.categories).map(([cat, count]) => (
              <span
                key={cat}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                  CATEGORY_COLORS[cat] || CATEGORY_COLORS.geral
                )}
              >
                {CATEGORY_LABELS[cat] || cat}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Upload .txt */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
              id="txt-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12"
            >
              {isImporting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 mr-2" />
              )}
              {isImporting ? "Importando..." : "Importar Arquivo .TXT"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Uma mensagem por linha • Linhas vazias serão ignoradas
            </p>
          </div>

          {/* Add single message */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-12 border-primary/50 text-primary hover:bg-primary/10">
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Manualmente
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>Adicionar Mensagem</DialogTitle>
                <DialogDescription>Adicione uma mensagem ao banco de maturação</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Mensagem</Label>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ex: E aí mano, tudo certo?"
                    className="mt-1.5 bg-input"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="mt-1.5 bg-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddMessage} disabled={!newMessage.trim()} className="bg-primary text-primary-foreground">
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete all */}
          <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-12 border-destructive/50 text-destructive hover:bg-destructive/10" disabled={stats.total === 0}>
                <Trash2 className="w-5 h-5 mr-2" />
                Limpar Tudo
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Excluir Todas as Mensagens?
                </DialogTitle>
                <DialogDescription>
                  Isso excluirá permanentemente {stats.total} mensagens. Essa ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await deleteAllMessages();
                    setDeleteAllDialogOpen(false);
                  }}
                >
                  Excluir Todas
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upload Guide */}
      <div className="glass-card rounded-xl p-5 border-primary/20">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Como criar o arquivo .TXT
        </h3>
        <div className="text-sm text-muted-foreground space-y-1.5">
          <p>1. Abra o Bloco de Notas (ou qualquer editor de texto)</p>
          <p>2. Escreva <strong>uma mensagem por linha</strong></p>
          <p>3. Salve como <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.txt</code></p>
          <p>4. Clique em "Importar Arquivo .TXT" e selecione o arquivo</p>
        </div>
        <div className="mt-3 bg-background/80 rounded-lg p-3 font-mono text-xs border border-border">
          <p className="text-primary">Exemplo do arquivo:</p>
          <p className="text-foreground/80 mt-1">E aí mano, suave?</p>
          <p className="text-foreground/80">Fala parceiro, tudo certo?</p>
          <p className="text-foreground/80">Opa, beleza? Quanto tempo!</p>
          <p className="text-foreground/80">Bora jogar uma bola?</p>
          <p className="text-foreground/80">Kkk lembrei de vc agora</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 <strong>Dica:</strong> Nomeie o arquivo com a categoria (ex: <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">saudacao.txt</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">zoeira.txt</code>) para categorizar automaticamente!
        </p>
      </div>

      {/* Filter & Search */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mensagens..."
              className="pl-10 bg-input"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-[200px] bg-input">
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat} ({stats.categories[cat]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : messages.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">
            {searchQuery || filter !== "all" 
              ? "Nenhuma mensagem encontrada com esse filtro" 
              : "Nenhuma mensagem no banco ainda"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Importe um arquivo .TXT ou adicione mensagens manualmente
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              Mensagens ({messages.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                  msg.is_active
                    ? "bg-card/60 border-border/50 hover:border-primary/30"
                    : "bg-muted/30 border-border/30 opacity-60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm truncate", !msg.is_active && "line-through")}>
                    {msg.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border",
                      CATEGORY_COLORS[msg.category] || CATEGORY_COLORS.geral
                    )}>
                      {CATEGORY_LABELS[msg.category] || msg.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Usado {msg.used_count}x
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleMessage(msg.id, !msg.is_active)}
                    title={msg.is_active ? "Desativar" : "Ativar"}
                  >
                    {msg.is_active ? (
                      <ToggleRight className="w-4 h-4 text-primary" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMessage(msg.id)}
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
