import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, evolutionApiUrl, evolutionApiKey, data } = await req.json();

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Evolution API URL and Key are required");
    }

    const baseUrl = evolutionApiUrl.replace(/\/$/, "");
    let endpoint = "";
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "create":
        endpoint = `/instance/create`;
        method = "POST";
        body = JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" });
        break;
      case "connect":
        endpoint = `/instance/connect/${instanceName}`;
        break;
      case "status":
        endpoint = `/instance/connectionState/${instanceName}`;
        break;
      case "logout":
        endpoint = `/instance/logout/${instanceName}`;
        method = "DELETE";
        break;
      case "delete":
        endpoint = `/instance/delete/${instanceName}`;
        method = "DELETE";
        break;
      case "sendText":
        endpoint = `/message/sendText/${instanceName}`;
        method = "POST";
        body = JSON.stringify(data);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[Evolution Proxy] ${method} ${baseUrl}${endpoint}`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body,
    });

    const result = await response.json();
    console.log(`[Evolution Proxy] Response:`, JSON.stringify(result).slice(0, 200));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.ok ? 200 : 400,
    });
  } catch (error: any) {
    console.error("[Evolution Proxy] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
