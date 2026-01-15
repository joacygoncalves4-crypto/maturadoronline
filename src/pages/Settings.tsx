import { useState, useEffect } from "react";
import { Save, Loader2, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";

const Settings = () => {
  const { settings, isLoading, isSaving, saveSettings } = useSettings();
  const [form, setForm] = useState(settings);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => { await saveSettings(form); };

  const testConnection = async () => {
    if (!form.evolutionApiUrl) { toast.error("Insira a URL da API"); return; }
    try {
      const res = await fetch(`${form.evolutionApiUrl}/instance/fetchInstances`, {
        headers: { apikey: form.evolutionApiKey },
      });
      if (res.ok) toast.success("Conexão bem sucedida!");
      else toast.error("Falha na conexão");
    } catch { toast.error("Erro ao conectar"); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold neon-text">Configurações</h1>
        <p className="text-muted-foreground mt-1">Configure as integrações do sistema</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-semibold">Evolution API</h2>
        <div className="space-y-4">
          <div>
            <Label>URL da API</Label>
            <Input value={form.evolutionApiUrl} onChange={(e) => setForm({ ...form, evolutionApiUrl: e.target.value })} placeholder="https://api.meudominio.com" className="mt-1.5 bg-input" />
          </div>
          <div>
            <Label>API Key (Global)</Label>
            <Input type="password" value={form.evolutionApiKey} onChange={(e) => setForm({ ...form, evolutionApiKey: e.target.value })} placeholder="Sua chave de API" className="mt-1.5 bg-input" />
          </div>
        </div>
        <Button variant="outline" onClick={testConnection} className="w-full"><TestTube className="w-4 h-4 mr-2" />Testar Conexão</Button>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Google Gemini</h2>
        <div>
          <Label>API Token</Label>
          <Input type="password" value={form.geminiApiToken} onChange={(e) => setForm({ ...form, geminiApiToken: e.target.value })} placeholder="Sua chave Gemini (opcional)" className="mt-1.5 bg-input" />
          <p className="text-xs text-muted-foreground mt-1">Opcional: usado para gerar mensagens humanizadas</p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full bg-primary text-primary-foreground">
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default Settings;
