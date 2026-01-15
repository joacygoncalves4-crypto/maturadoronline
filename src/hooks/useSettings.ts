import { useState, useEffect, useCallback } from "react";
import { getSettings, setSetting } from "@/lib/supabase";
import { toast } from "sonner";

export interface AppSettings {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  geminiApiToken: string;
}

const SETTING_KEYS = {
  evolutionApiUrl: "EVOLUTION_API_URL",
  evolutionApiKey: "EVOLUTION_API_KEY",
  geminiApiToken: "GEMINI_API_TOKEN",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    evolutionApiUrl: "",
    evolutionApiKey: "",
    geminiApiToken: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSettings();
      
      setSettings({
        evolutionApiUrl: data[SETTING_KEYS.evolutionApiUrl] || "",
        evolutionApiKey: data[SETTING_KEYS.evolutionApiKey] || "",
        geminiApiToken: data[SETTING_KEYS.geminiApiToken] || "",
      });
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      setIsSaving(true);
      
      await Promise.all([
        setSetting(SETTING_KEYS.evolutionApiUrl, newSettings.evolutionApiUrl),
        setSetting(SETTING_KEYS.evolutionApiKey, newSettings.evolutionApiKey),
        setSetting(SETTING_KEYS.geminiApiToken, newSettings.geminiApiToken),
      ]);

      setSettings(newSettings);
      toast.success("Configurações salvas com sucesso!");
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const hasRequiredSettings = Boolean(
    settings.evolutionApiUrl && settings.evolutionApiKey
  );

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    hasRequiredSettings,
    reload: loadSettings,
  };
}
