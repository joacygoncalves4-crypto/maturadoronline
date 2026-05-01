const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://dados-supabase.rt19gx.easypanel.host";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "* * * * *";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getBrazilHour() {
  const utcHour = new Date().getUTCHours();
  let h = utcHour - 3;
  if (h < 0) h += 24;
  if (h >= 24) h -= 24;
  return h;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDailyLimit(warmingStartDate, baseLimit) {
  if (!warmingStartDate) return baseLimit;
  const days = Math.floor((Date.now() - new Date(warmingStartDate).getTime()) / 86400000);
  if (days <= 3)  return Math.min(10, baseLimit);
  if (days <= 7)  return Math.min(20, baseLimit);
  if (days <= 14) return Math.min(35, baseLimit);
  if (days <= 21) return Math.min(50, baseLimit);
  return baseLimit;
}

async function runWarmerCycle() {
  const ts = new Date().toISOString();

  try {
    // 1. Status do sistema
    const { data: status, error: statusErr } = await supabase
      .from("system_status").select("*").single();

    if (statusErr || !status) {
      console.log(`[${ts}] Sem configuração no banco`);
      return;
    }
    if (!status.is_active) {
      console.log(`[${ts}] ⏸  Sistema pausado`);
      return;
    }

    // 2. Respeitar intervalo configurado
    const intervalMs = Math.max(1, status.interval_minutes || 5) * 60 * 1000;
    if (status.last_execution) {
      const elapsed = Date.now() - new Date(status.last_execution).getTime();
      if (elapsed < intervalMs) {
        const wait = Math.ceil((intervalMs - elapsed) / 1000);
        console.log(`[${ts}] ⏳ Intervalo não atingido — aguardando ${wait}s`);
        return;
      }
    }

    // 3. Horário ativo (horário de Brasília)
    const hour = getBrazilHour();
    const start = status.start_hour ?? 8;
    const end   = status.end_hour   ?? 22;
    if (hour < start || hour >= end) {
      console.log(`[${ts}] 😴 Fora do horário (${hour}h BRT, ativo: ${start}-${end}h)`);
      return;
    }

    // 4. Configurações da Evolution API
    const { data: settingsRows } = await supabase.from("settings").select("key, value");
    const cfg = {};
    (settingsRows || []).forEach((r) => { cfg[r.key] = r.value; });

    const evoUrl = cfg["EVOLUTION_API_URL"];
    const evoKey = cfg["EVOLUTION_API_KEY"];
    if (!evoUrl || !evoKey) {
      console.log(`[${ts}] ⚠️  Evolution API não configurada (vá em Settings no painel)`);
      return;
    }
    const baseUrl = evoUrl.replace(/\/$/, "");

    // 5. Instâncias ativas com warmer ligado
    const { data: instances } = await supabase
      .from("instances").select("*")
      .in("status", ["open", "connected"])
      .eq("is_warmer_enabled", true);

    if (!instances || instances.length < 2) {
      console.log(`[${ts}] ⚠️  Precisa de pelo menos 2 chips ativos (${instances?.length || 0} disponíveis)`);
      return;
    }

    // 6. Resetar contadores diários se necessário
    const today = new Date().toISOString().split("T")[0];
    for (const inst of instances) {
      if (inst.last_message_date !== today) {
        await supabase.from("instances")
          .update({ messages_sent_today: 0, last_message_date: today })
          .eq("id", inst.id);
        inst.messages_sent_today = 0;
      }
    }

    // 7. Filtrar quem ainda não atingiu limite diário
    const available = instances.filter((inst) => {
      const lim = getDailyLimit(inst.warming_start_date, inst.daily_limit || status.daily_limit_per_chip || 40);
      return (inst.messages_sent_today || 0) < lim;
    });

    if (available.length < 2) {
      console.log(`[${ts}] 📊 Limite diário atingido para todos os chips`);
      return;
    }

    const valid = available.filter((i) => i.phone_number);
    if (valid.length < 2) {
      console.log(`[${ts}] ⚠️  Chips sem número de telefone cadastrado`);
      return;
    }

    // 8. Rotação matricial — escolhe o par menos usado
    const pairs = [];
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i], b = valid[j];
        pairs.push({ a, b, key: [a.phone_number, b.phone_number].sort().join("<->") });
      }
    }

    const { data: recentLogs } = await supabase
      .from("logs").select("from_number, to_number, created_at").eq("type", "message")
      .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(1000);

    const pairCount = {}, pairLast = {}, senderCount = {};
    for (const log of recentLogs || []) {
      const k = [log.from_number, log.to_number].sort().join("<->");
      pairCount[k] = (pairCount[k] || 0) + 1;
      const t = new Date(log.created_at).getTime();
      if (!pairLast[k] || t > pairLast[k]) pairLast[k] = t;
      senderCount[log.from_number] = (senderCount[log.from_number] || 0) + 1;
    }

    const scored = pairs
      .map((p) => ({ ...p, count: pairCount[p.key] || 0, last: pairLast[p.key] || 0 }))
      .sort((x, y) => x.count !== y.count ? x.count - y.count : x.last - y.last);

    const minCount = scored[0].count;
    const chosen = scored.filter((p) => p.count === minCount)[0];

    // Decidir direção (quem envia menos envia agora)
    const aSent = senderCount[chosen.a.phone_number] || 0;
    const bSent = senderCount[chosen.b.phone_number] || 0;
    let sender, receiver;
    if (aSent <= bSent) { sender = chosen.a; receiver = chosen.b; }
    else                { sender = chosen.b; receiver = chosen.a; }

    // 9. Escolher mensagem menos usada
    const { data: messages } = await supabase.from("messages").select("*").eq("is_active", true);
    let text = "E aí, tudo certo?";

    if (messages && messages.length > 0) {
      const sorted = [...messages].sort((a, b) => (a.used_count || 0) - (b.used_count || 0));
      const minUsed = sorted[0].used_count || 0;
      const pool = sorted.filter((m) => (m.used_count || 0) <= minUsed + 2);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      text = picked.content;
      await supabase.from("messages")
        .update({ used_count: (picked.used_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", picked.id);
    }

    // 10. Enviar mensagem via Evolution API
    const delay = rand(3000, 8000);
    console.log(`[${ts}] 📤 ${sender.instance_name} → ${receiver.phone_number} | "${text}"`);

    const res = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(sender.instance_name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": evoKey },
        body: JSON.stringify({ number: receiver.phone_number, text, delay }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.log(`[${ts}] ❌ Falha no envio (${res.status}): ${errBody.slice(0, 200)}`);
      await supabase.from("logs").insert({
        from_number: sender.phone_number || sender.instance_name,
        to_number:   receiver.phone_number || receiver.instance_name,
        message_content: `[ERRO ${res.status}] ${errBody.slice(0, 400)}`,
        type: "error",
      });
    } else {
      console.log(`[${ts}] ✅ Enviado!`);
      await supabase.from("logs").insert({
        from_number: sender.phone_number || sender.instance_name,
        to_number:   receiver.phone_number || receiver.instance_name,
        message_content: text,
        type: "message",
      });
      await supabase.from("instances")
        .update({ messages_sent_today: (sender.messages_sent_today || 0) + 1, last_message_date: today })
        .eq("id", sender.id);

      // 11. Resposta bidirecional (60% de chance)
      if (status.enable_bidirectional && Math.random() > 0.4 && messages && messages.length > 0) {
        const pool2 = messages.filter((m) => m.content !== text && m.is_active);
        if (pool2.length > 0) {
          const replyMsg = pool2[Math.floor(Math.random() * pool2.length)];
          await new Promise((r) => setTimeout(r, rand(8000, 20000)));

          const res2 = await fetch(
            `${baseUrl}/message/sendText/${encodeURIComponent(receiver.instance_name)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evoKey },
              body: JSON.stringify({ number: sender.phone_number, text: replyMsg.content, delay: rand(3000, 6000) }),
            }
          );

          if (res2.ok) {
            console.log(`[${ts}] ↩️  Bidirecional: ${receiver.instance_name} → ${sender.phone_number}`);
            await supabase.from("logs").insert({
              from_number: receiver.phone_number || receiver.instance_name,
              to_number:   sender.phone_number   || sender.instance_name,
              message_content: replyMsg.content,
              type: "message",
            });
            await supabase.from("instances")
              .update({ messages_sent_today: (receiver.messages_sent_today || 0) + 1, last_message_date: today })
              .eq("id", receiver.id);
          }
        }
      }
    }

    // 12. Atualizar last_execution
    await supabase.from("system_status")
      .update({ last_execution: new Date().toISOString() })
      .eq("id", status.id);

  } catch (err) {
    console.error(`[${ts}] ❌ Erro:`, err.message);
  }
}

console.log("🔥 Maturador Worker v2 iniciado");
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log(`   Schedule: ${CRON_SCHEDULE}`);
console.log("");

runWarmerCycle();
cron.schedule(CRON_SCHEDULE, runWarmerCycle);
