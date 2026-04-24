import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazil timezone offset (UTC-3)
const BRAZIL_TZ_OFFSET = -3;

function getBrazilHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  let brHour = utcHour + BRAZIL_TZ_OFFSET;
  if (brHour < 0) brHour += 24;
  if (brHour >= 24) brHour -= 24;
  return brHour;
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[Warmer Cron] Starting cycle...");

    // 1. Check system status
    const { data: status, error: statusError } = await supabase
      .from("system_status")
      .select("*")
      .single();

    if (statusError || !status) {
      console.log("[Warmer Cron] No system status found");
      return jsonResponse({ status: "no_config" });
    }

    if (!status.is_active) {
      console.log("[Warmer Cron] System is paused");
      return jsonResponse({ status: "paused" });
    }

    // 2. Check Brazil time - only run during active hours
    const currentHour = getBrazilHour();
    const startHour = status.start_hour ?? 8;
    const endHour = status.end_hour ?? 22;

    if (currentHour < startHour || currentHour >= endHour) {
      console.log(`[Warmer Cron] Outside active hours (${currentHour}h, active: ${startHour}-${endHour}h)`);
      return jsonResponse({ status: "sleeping", hour: currentHour });
    }

    // 3. Get API settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("key, value");

    const settings: Record<string, string> = {};
    settingsData?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    const evolutionApiUrl = settings["EVOLUTION_API_URL"];
    const evolutionApiKey = settings["EVOLUTION_API_KEY"];

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log("[Warmer Cron] Missing Evolution API settings");
      return jsonResponse({ status: "no_api_config" });
    }

    // 4. Get active instances enabled for warmer
    const { data: instances } = await supabase
      .from("instances")
      .select("*")
      .in("status", ["open", "connected"])
      .eq("is_warmer_enabled", true);

    if (!instances || instances.length < 2) {
      console.log(`[Warmer Cron] Not enough active instances (${instances?.length || 0})`);
      return jsonResponse({ status: "insufficient_instances", count: instances?.length || 0 });
    }

    // 5. Reset daily counters if needed
    const today = new Date().toISOString().split("T")[0];
    for (const inst of instances) {
      if (inst.last_message_date !== today) {
        await supabase
          .from("instances")
          .update({ messages_sent_today: 0, last_message_date: today })
          .eq("id", inst.id);
        inst.messages_sent_today = 0;
      }
    }

    // 6. Calculate daily limit based on warming age (gradual ramp)
    const getDailyLimit = (warmingStartDate: string | null, baseLimit: number): number => {
      if (!warmingStartDate) return baseLimit;
      const start = new Date(warmingStartDate);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart <= 3) return Math.min(10, baseLimit);       // Days 1-3: max 10 msgs
      if (daysSinceStart <= 7) return Math.min(20, baseLimit);       // Days 4-7: max 20 msgs
      if (daysSinceStart <= 14) return Math.min(35, baseLimit);      // Days 8-14: max 35 msgs
      if (daysSinceStart <= 21) return Math.min(50, baseLimit);      // Days 15-21: max 50 msgs
      return baseLimit;                                               // 22+ days: full limit
    };

    // 7. Filter instances that haven't hit daily limit
    const availableInstances = instances.filter((inst) => {
      const limit = getDailyLimit(inst.warming_start_date, inst.daily_limit || status.daily_limit_per_chip || 40);
      return (inst.messages_sent_today || 0) < limit;
    });

    if (availableInstances.length < 2) {
      console.log("[Warmer Cron] All instances hit daily limit");
      return jsonResponse({ status: "daily_limit_reached" });
    }

    const baseUrl = evolutionApiUrl.replace(/\/$/, "");

    // 8. Fair pair rotation - pick the pair that has talked the LEAST
    // Generate all possible pairs from available instances
    const allPairs: { sender: typeof availableInstances[0]; receiver: typeof availableInstances[0] }[] = [];
    for (let i = 0; i < availableInstances.length; i++) {
      for (let j = 0; j < availableInstances.length; j++) {
        if (i !== j) {
          allPairs.push({ sender: availableInstances[i], receiver: availableInstances[j] });
        }
      }
    }

    // Check recent logs to find the least-used pair
    const { data: recentLogs } = await supabase
      .from("logs")
      .select("from_number, to_number")
      .eq("type", "message")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    // Count messages per pair
    const pairCounts: Record<string, number> = {};
    for (const log of recentLogs || []) {
      const key = `${log.from_number}->${log.to_number}`;
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    }

    // Score each pair (lower = should be picked first)
    const scoredPairs = allPairs
      .filter((p) => p.sender.phone_number && p.receiver.phone_number)
      .map((p) => ({
        ...p,
        score: (pairCounts[`${p.sender.phone_number}->${p.receiver.phone_number}`] || 0),
      }))
      .sort((a, b) => a.score - b.score);

    if (scoredPairs.length === 0) {
      console.log("[Warmer Cron] No valid pairs found");
      return jsonResponse({ status: "no_valid_pairs" });
    }

    // Pick from the least-used pairs (with some randomness among ties)
    const minScore = scoredPairs[0].score;
    const leastUsedPairs = scoredPairs.filter((p) => p.score <= minScore + 1);
    const chosen = leastUsedPairs[Math.floor(Math.random() * leastUsedPairs.length)];
    const sender = chosen.sender;
    const receiver = chosen.receiver;

    console.log(`[Warmer Cron] Fair rotation: pair score=${chosen.score}, least-used among ${leastUsedPairs.length} candidates`);

    if (!sender.phone_number || !receiver.phone_number) {
      console.log("[Warmer Cron] Instances missing phone numbers");
      return jsonResponse({ status: "missing_phone_numbers" });
    }

    const validateInstanceExists = async (instance: (typeof availableInstances)[number]) => {
      const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance.instance_name)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });

      const statusText = await statusResponse.text();
      if (statusResponse.ok) return true;

      console.log(`[Warmer Cron] Validation failed (${statusResponse.status}) for ${instance.instance_name}:`, statusText.slice(0, 200));

      if (statusResponse.status === 404 || statusText.includes("does not exist") || statusText.includes("Not Found")) {
        await supabase
          .from("instances")
          .update({
            status: "disconnected",
            phone_number: null,
            qr_code: null,
            is_warmer_enabled: false,
          })
          .eq("id", instance.id);

        await supabase.from("logs").insert({
          from_number: instance.phone_number || instance.instance_name,
          to_number: instance.instance_name,
          message_content: `[ERRO] Instância removida da Evolution: ${instance.instance_name}`,
          type: "error",
        });
      }

      return false;
    };

    const senderExists = await validateInstanceExists(sender);
    const receiverExists = await validateInstanceExists(receiver);

    if (!senderExists || !receiverExists) {
      return jsonResponse({ status: "stale_instance_skipped" });
    }

    // 9. Get a random message from the database
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("is_active", true);

    let messageText = "E aí, tudo certo?"; // Ultimate fallback

    if (messages && messages.length > 0) {
      // Pick least-used messages first for variety
      const sorted = messages.sort((a, b) => (a.used_count || 0) - (b.used_count || 0));
      const leastUsedCount = sorted[0].used_count || 0;
      const leastUsed = sorted.filter((m) => (m.used_count || 0) <= leastUsedCount + 2);
      const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)];
      messageText = chosen.content;

      // Update usage counter
      await supabase
        .from("messages")
        .update({
          used_count: (chosen.used_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", chosen.id);
    }

    // 10. Send message via Evolution API with humanized delay
    const humanDelay = getRandomDelay(3000, 8000); // 3-8 seconds

    console.log(`[Warmer Cron] Sending: ${sender.instance_name} → ${receiver.phone_number}: "${messageText}"`);

    const sendResponse = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(sender.instance_name)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        number: receiver.phone_number,
        text: messageText,
        delay: humanDelay,
      }),
    });

    const sendResult = await sendResponse.text();
    console.log(`[Warmer Cron] Send result (${sendResponse.status}):`, sendResult.slice(0, 300));

    if (!sendResponse.ok) {
      // Log error
      await supabase.from("logs").insert({
        from_number: sender.phone_number || sender.instance_name,
        to_number: receiver.phone_number || receiver.instance_name,
        message_content: `[ERRO] ${sendResult.slice(0, 200)}`,
        type: "error",
      });
      throw new Error(`Evolution API error: ${sendResponse.status}`);
    }

    // 11. Log success
    await supabase.from("logs").insert({
      from_number: sender.phone_number || sender.instance_name,
      to_number: receiver.phone_number || receiver.instance_name,
      message_content: messageText,
      type: "message",
    });

    // 12. Update sender's daily counter
    await supabase
      .from("instances")
      .update({
        messages_sent_today: (sender.messages_sent_today || 0) + 1,
        last_message_date: today,
      })
      .eq("id", sender.id);

    // 13. Bidirectional warming - sometimes the receiver responds back
    if (status.enable_bidirectional && Math.random() > 0.4) {
      // 60% chance of bidirectional response
      const responseDelay = getRandomDelay(10000, 45000); // Wait 10-45 seconds for "response"
      
      // Pick a different message for the response
      const responseMessages = (messages || []).filter((m) => m.content !== messageText && m.is_active);
      if (responseMessages.length > 0) {
        const responseMsg = responseMessages[Math.floor(Math.random() * responseMessages.length)];

        // Wait a bit to simulate reading time
        await new Promise((resolve) => setTimeout(resolve, Math.min(responseDelay, 15000)));

        console.log(`[Warmer Cron] Bidirectional: ${receiver.instance_name} → ${sender.phone_number}: "${responseMsg.content}"`);

        const biResponse = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(receiver.instance_name)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            number: sender.phone_number,
            text: responseMsg.content,
            delay: getRandomDelay(3000, 6000),
          }),
        });

        if (biResponse.ok) {
          await supabase.from("logs").insert({
            from_number: receiver.phone_number || receiver.instance_name,
            to_number: sender.phone_number || sender.instance_name,
            message_content: responseMsg.content,
            type: "message",
          });

          await supabase
            .from("instances")
            .update({
              messages_sent_today: (receiver.messages_sent_today || 0) + 1,
              last_message_date: today,
            })
            .eq("id", receiver.id);

          // Update usage
          await supabase
            .from("messages")
            .update({
              used_count: (responseMsg.used_count || 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", responseMsg.id);
        }
      }
    }

    // 14. Update last execution time
    await supabase
      .from("system_status")
      .update({ last_execution: new Date().toISOString() })
      .eq("id", status.id);

    console.log("[Warmer Cron] Cycle completed successfully!");

    return jsonResponse({
      status: "success",
      sender: sender.instance_name,
      receiver: receiver.instance_name,
      message: messageText,
      hour: currentHour,
    });
  } catch (error: any) {
    console.error("[Warmer Cron] Error:", error.message);
    return jsonResponse({ status: "error", error: error.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
