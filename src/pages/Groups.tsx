import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Loader2, Power, MessageCircle, Link as LinkIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  Group,
  getInstances,
  Instance,
  getSystemStatus,
  updateSystemStatus,
  SystemStatus,
  getSettings,
} from "@/lib/supabase";

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const [newGroup, setNewGroup] = useState({
    name: "",
    group_jid: "",
    invite_link: "",
    description: "",
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [g, i, s] = await Promise.all([getGroups(), getInstances(), getSystemStatus()]);
      setGroups(g);
      setInstances(i);
      setSystemStatus(s);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newGroup.name || !newGroup.group_jid) {
      toast.error("Nome e Group JID são obrigatórios");
      return;
    }

    const created = await createGroup({
      name: newGroup.name,
      group_jid: newGroup.group_jid,
      invite_link: newGroup.invite_link || null,
      description: newGroup.description || null,
      is_active: true,
    });

    if (!created) {
      toast.error("Erro ao criar grupo (talvez o JID já exista?)");
      return;
    }

    toast.success("Grupo cadastrado!");
    setDialogOpen(false);
    setNewGroup({ name: "", group_jid: "", invite_link: "", description: "" });
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este grupo do maturador?")) return;
    await deleteGroup(id);
    toast.success("Grupo removido");
    await loadData();
  };

  const toggleGroup = async (group: Group, active: boolean) => {
    await updateGroup(group.id, { is_active: active });
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, is_active: active } : g)));
  };

  const toggleGroupMessages = async (enabled: boolean) => {
    await updateSystemStatus({ enable_group_messages: enabled });
    setSystemStatus((p) => (p ? { ...p, enable_group_messages: enabled } : null));
    toast.success(enabled ? "Mensagens em grupos ATIVADAS" : "Mensagens em grupos pausadas");
  };

  const updateRatio = async (ratio: number) => {
    await updateSystemStatus({ group_message_ratio: ratio });
    setSystemStatus((p) => (p ? { ...p, group_message_ratio: ratio } : null));
  };

  // Importar grupos da Evolution API (de um chip específico)
  const handleImportFromEvolution = async () => {
    if (instances.length === 0) {
      toast.error("Conecte pelo menos um chip primeiro");
      return;
    }

    const settings = await getSettings();
    const evoUrl = settings["EVOLUTION_API_URL"];
    const evoKey = settings["EVOLUTION_API_KEY"];
    if (!evoUrl || !evoKey) {
      toast.error("Configure a Evolution API em Settings primeiro");
      return;
    }

    const connectedInstance = instances.find((i) => i.status === "open" || i.status === "connected");
    if (!connectedInstance) {
      toast.error("Nenhum chip conectado. Conecte um chip primeiro");
      return;
    }

    try {
      setImporting(true);
      toast.info(`Buscando grupos do chip ${connectedInstance.instance_name}...`);

      const baseUrl = evoUrl.replace(/\/$/, "");
      const res = await fetch(
        `${baseUrl}/group/fetchAllGroups/${encodeURIComponent(connectedInstance.instance_name)}?getParticipants=false`,
        { headers: { apikey: evoKey } }
      );

      if (!res.ok) {
        const err = await res.text();
        toast.error(`Falha: ${err.slice(0, 100)}`);
        return;
      }

      const data = await res.json();
      const evolutionGroups = Array.isArray(data) ? data : data.groups || [];

      if (evolutionGroups.length === 0) {
        toast.info("Nenhum grupo encontrado neste chip");
        return;
      }

      // Inserir grupos novos (que ainda não estão no banco)
      const existingJids = new Set(groups.map((g) => g.group_jid));
      let imported = 0;

      for (const g of evolutionGroups) {
        const jid = g.id || g.remoteJid;
        const name = g.subject || g.name || "Grupo sem nome";
        if (!jid || existingJids.has(jid)) continue;

        await createGroup({
          group_jid: jid,
          name,
          description: g.desc || null,
          is_active: false, // começa desativado por segurança
        });
        imported++;
      }

      toast.success(`${imported} grupo(s) importado(s)`);
      await loadData();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold neon-text">Grupos de Maturação</h1>
        <p className="text-muted-foreground mt-1">
          Chips conversam em grupos para parecer mais natural
        </p>
      </div>

      {/* Card de configuração geral */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                systemStatus?.enable_group_messages ? "bg-primary/20 neon-glow" : "bg-muted"
              }`}
            >
              <MessageCircle
                className={`w-7 h-7 ${
                  systemStatus?.enable_group_messages ? "text-primary" : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Mensagens em Grupos</h2>
              <p className="text-sm text-muted-foreground">
                {groups.filter((g) => g.is_active).length} grupos ativos
              </p>
            </div>
          </div>
          <Switch
            checked={systemStatus?.enable_group_messages || false}
            onCheckedChange={toggleGroupMessages}
            disabled={groups.filter((g) => g.is_active).length === 0}
          />
        </div>

        <div>
          <Label className="text-sm font-medium">
            Proporção de mensagens em grupos: {systemStatus?.group_message_ratio || 30}%
          </Label>
          <Slider
            value={[systemStatus?.group_message_ratio || 30]}
            onValueChange={([v]) => updateRatio(v)}
            min={0}
            max={100}
            step={10}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Quanto do tráfego total vai pra grupos. Resto vai pra chat direto.
          </p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3 flex-wrap">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Grupo de Maturação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Grupo</Label>
                <Input
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Ex: Grupo Maturação 1"
                />
              </div>
              <div>
                <Label>Group JID (ID do WhatsApp)</Label>
                <Input
                  value={newGroup.group_jid}
                  onChange={(e) => setNewGroup({ ...newGroup, group_jid: e.target.value })}
                  placeholder="Ex: 120363012345678901@g.us"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pega no WhatsApp Web → Info do Grupo → Copy ID, ou use o botão "Importar"
                </p>
              </div>
              <div>
                <Label>Link de Convite (opcional)</Label>
                <Input
                  value={newGroup.invite_link}
                  onChange={(e) => setNewGroup({ ...newGroup, invite_link: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" onClick={handleImportFromEvolution} disabled={importing}>
          {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Importar da Evolution
        </Button>
      </div>

      {/* Lista de grupos */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Grupos Cadastrados ({groups.length})</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhum grupo cadastrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Cadastra ou importa grupos da Evolution API
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between p-4 rounded-lg bg-card/60 border border-border/30"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      g.is_active ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    <Users className={`w-5 h-5 ${g.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{g.group_jid}</p>
                    <p className="text-xs text-muted-foreground/70">
                      {g.messages_sent_count} msgs enviadas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch checked={g.is_active} onCheckedChange={(v) => toggleGroup(g, v)} />
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
