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
    const encodedName = instanceName ? encodeURIComponent(instanceName) : "";
    let endpoint = "";
    let method = "GET";
    let body: string | undefined;

    console.log(`[Evolution Proxy] Action: ${action}, Instance: ${instanceName}`);

    switch (action) {
      case "create":
        // Evolution API v2 create instance
        endpoint = `/instance/create`;
        method = "POST";
        body = JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          reject_call: false,
          groupsIgnore: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        });
        break;
        
      case "connect":
        // Get QR Code for existing instance
        endpoint = `/instance/connect/${instanceName}`;
        method = "GET";
        break;
        
      case "fetchQr":
        // Fetch QR code base64
        endpoint = `/instance/connect/${instanceName}`;
        method = "GET";
        break;
        
      case "status":
        // Check connection state
        endpoint = `/instance/connectionState/${instanceName}`;
        method = "GET";
        break;
        
      case "fetchInstances":
        // List all instances
        endpoint = `/instance/fetchInstances`;
        method = "GET";
        break;
        
      case "fetchInstance":
        // Fetch single instance details (includes phone number)
        endpoint = `/instance/fetchInstances?instanceName=${instanceName}`;
        method = "GET";
        break;
        
      case "logout":
        // Logout from WhatsApp
        endpoint = `/instance/logout/${instanceName}`;
        method = "DELETE";
        break;
        
      case "delete":
        // Delete instance completely
        endpoint = `/instance/delete/${instanceName}`;
        method = "DELETE";
        break;
        
      case "sendText":
        // Send text message
        endpoint = `/message/sendText/${instanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: data.number,
          text: data.text,
          delay: data.delay || 1000,
        });
        break;
        
      case "sendMedia":
        // Send media (for status/stories)
        endpoint = `/message/sendMedia/${instanceName}`;
        method = "POST";
        body = JSON.stringify({
          number: "status@broadcast",
          mediatype: data.mediatype || "image",
          mimetype: data.mimetype || "image/jpeg",
          caption: data.caption || "",
          media: data.media, // base64 or URL
        });
        break;
        
      case "sendStatus":
        // Post status/story
        endpoint = `/message/sendStatus/${instanceName}`;
        method = "POST";
        body = JSON.stringify({
          type: data.type || "image",
          content: data.content,
          caption: data.caption || "",
          allContacts: true,
          statusJidList: [],
        });
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[Evolution Proxy] ${method} ${baseUrl}${endpoint}`);
    if (body) {
      console.log(`[Evolution Proxy] Body:`, body.slice(0, 300));
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 
        "Content-Type": "application/json", 
        "apikey": evolutionApiKey,
      },
      body: method !== "GET" ? body : undefined,
    });

    const responseText = await response.text();
    console.log(`[Evolution Proxy] Status: ${response.status}`);
    console.log(`[Evolution Proxy] Response:`, responseText.slice(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    // Handle Evolution API v2 response format
    if (!response.ok) {
      const errorMsg = result.message || result.error || result.raw || "Evolution API error";
      throw new Error(errorMsg);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[Evolution Proxy] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
