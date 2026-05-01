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

// ─── WARMER (mensagens entre chips) ────────────────────────────
async function runWarmerCycle(status, instances, baseUrl, evoKey, today) {
  const ts = new Date().toISOString();

  // 1. Respeitar intervalo
  const intervalMs = Math.max(1, status.interval_minutes || 5) * 60 * 1000;
  if (status.last_execution) {
    const elapsed = Date.now() - new Date(status.last_execution).getTime();
    if (elapsed < intervalMs) {
      const wait = Math.ceil((intervalMs - elapsed) / 1000);
      console.log(`[${ts}] [warmer] ⏳ Aguardando intervalo (${wait}s)`);
      return;
    }
  }

  // 2. Filtrar quem ainda não atingiu limite diário
  const available = instances.filter((inst) => {
    const lim = getDailyLimit(inst.warming_start_date, inst.daily_limit || status.daily_limit_per_chip || 40);
    return (inst.messages_sent_today || 0) < lim;
  });

  if (available.length < 2) {
    console.log(`[${ts}] [warmer] 📊 Limite diário atingido em todos`);
    return;
  }

  const valid = available.filter((i) => i.phone_number);
  if (valid.length < 2) {
    console.log(`[${ts}] [warmer] ⚠️  Chips sem número`);
    return;
  }

  // 3. Rotação matricial
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

  const aSent = senderCount[chosen.a.phone_number] || 0;
  const bSent = senderCount[chosen.b.phone_number] || 0;
  let sender, receiver;
  if (aSent <= bSent) { sender = chosen.a; receiver = chosen.b; }
  else                { sender = chosen.b; receiver = chosen.a; }

  // 4. Escolher mensagem
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

  // 5. Enviar
  const delay = rand(3000, 8000);
  console.log(`[${ts}] [warmer] 📤 ${sender.instance_name} → ${receiver.phone_number} | "${text}"`);

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
    console.log(`[${ts}] [warmer] ❌ Falha (${res.status}): ${errBody.slice(0, 200)}`);
    await supabase.from("logs").insert({
      from_number: sender.phone_number || sender.instance_name,
      to_number:   receiver.phone_number || receiver.instance_name,
      message_content: `[ERRO ${res.status}] ${errBody.slice(0, 400)}`,
      type: "error",
    });
  } else {
    console.log(`[${ts}] [warmer] ✅ Enviado!`);
    await supabase.from("logs").insert({
      from_number: sender.phone_number || sender.instance_name,
      to_number:   receiver.phone_number || receiver.instance_name,
      message_content: text,
      type: "message",
    });
    await supabase.from("instances")
      .update({ messages_sent_today: (sender.messages_sent_today || 0) + 1, last_message_date: today })
      .eq("id", sender.id);

    // Bidirecional
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
          console.log(`[${ts}] [warmer] ↩️  Bidirecional: ${receiver.instance_name} → ${sender.phone_number}`);
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

  // 6. Atualizar last_execution
  await supabase.from("system_status")
    .update({ last_execution: new Date().toISOString() })
    .eq("id", status.id);
}

// ─── GRUPOS (mensagens em grupos de maturação) ────────────────
async function runGroupMessageCycle(status, instances, baseUrl, evoKey, today) {
  const ts = new Date().toISOString();

  if (!status.enable_group_messages) return false;

  // Buscar grupos ativos com chips disponíveis
  const { data: activeGroups } = await supabase
    .from("groups").select("*").eq("is_active", true);

  if (!activeGroups || activeGroups.length === 0) {
    return false;
  }

  // Filtrar instâncias com limite diário disponível
  const available = instances.filter((inst) => {
    const lim = getDailyLimit(inst.warming_start_date, inst.daily_limit || status.daily_limit_per_chip || 40);
    return (inst.messages_sent_today || 0) < lim;
  });

  if (available.length === 0) {
    console.log(`[${ts}] [groups] 📊 Limite diário atingido`);
    return false;
  }

  // Escolher grupo menos usado recentemente
  const sortedGroups = [...activeGroups].sort((a, b) => {
    const aLast = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bLast = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return aLast - bLast;
  });
  const group = sortedGroups[0];

  // Escolher chip enviador (rotação por menos uso recente)
  const sortedChips = [...available].sort((a, b) => (a.messages_sent_today || 0) - (b.messages_sent_today || 0));
  const sender = sortedChips[0];

  // Pegar mensagem aleatória do banco
  const { data: messages } = await supabase.from("messages").select("*").eq("is_active", true);
  let text = "Salve galera!";
  let pickedMsg = null;

  if (messages && messages.length > 0) {
    const sorted = [...messages].sort((a, b) => (a.used_count || 0) - (b.used_count || 0));
    const minUsed = sorted[0].used_count || 0;
    const pool = sorted.filter((m) => (m.used_count || 0) <= minUsed + 2);
    pickedMsg = pool[Math.floor(Math.random() * pool.length)];
    text = pickedMsg.content;
  }

  console.log(`[${ts}] [groups] 📤 ${sender.instance_name} → "${group.name}" | "${text}"`);

  // Enviar para o grupo (number = group_jid)
  const res = await fetch(
    `${baseUrl}/message/sendText/${encodeURIComponent(sender.instance_name)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evoKey },
      body: JSON.stringify({
        number: group.group_jid,
        text,
        delay: rand(3000, 8000),
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.log(`[${ts}] [groups] ❌ Falha (${res.status}): ${errBody.slice(0, 200)}`);
    await supabase.from("logs").insert({
      from_number: sender.phone_number || sender.instance_name,
      to_number: group.group_jid,
      message_content: `[ERRO GRUPO ${res.status}] ${errBody.slice(0, 300)}`,
      type: "error",
    });
    return false;
  }

  console.log(`[${ts}] [groups] ✅ Enviado!`);

  // Atualizar contadores
  await supabase.from("logs").insert({
    from_number: sender.phone_number || sender.instance_name,
    to_number: group.group_jid,
    message_content: text,
    type: "group_message",
  });

  await supabase.from("instances")
    .update({
      messages_sent_today: (sender.messages_sent_today || 0) + 1,
      last_message_date: today,
    })
    .eq("id", sender.id);

  await supabase.from("groups")
    .update({
      messages_sent_count: (group.messages_sent_count || 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", group.id);

  if (pickedMsg) {
    await supabase.from("messages")
      .update({ used_count: (pickedMsg.used_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", pickedMsg.id);
  }

  return true;
}

// ─── STATUS POSTING (postar stories nos chips) ────────────────
async function runStatusPostingCycle(status, instances, baseUrl, evoKey, today) {
  const ts = new Date().toISOString();

  if (!status.enable_status_posting) return;

  // 1. Respeitar intervalo (em horas)
  const intervalMs = Math.max(1, status.status_interval_hours || 6) * 3600 * 1000;
  if (status.last_status_post) {
    const elapsed = Date.now() - new Date(status.last_status_post).getTime();
    if (elapsed < intervalMs) {
      const remainingMin = Math.ceil((intervalMs - elapsed) / 60000);
      console.log(`[${ts}] [status] ⏳ Próximo post em ${remainingMin}min`);
      return;
    }
  }

  // 2. Buscar mídia menos postada
  const { data: mediaList } = await supabase
    .from("media_queue").select("*")
    .order("posted_count", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (!mediaList || mediaList.length === 0) {
    console.log(`[${ts}] [status] 📭 Nenhuma mídia na fila para postar`);
    return;
  }

  // Pegar a menos postada
  const media = mediaList[0];
  const mediaType = (media.media_type || "image").toLowerCase();
  const isVideo = mediaType === "video" || /\.(mp4|mov|webm)$/i.test(media.file_name || "");

  console.log(`[${ts}] [status] 📸 Postando "${media.file_name}" (${isVideo ? "vídeo" : "imagem"}) em ${instances.length} chips`);

  let successCount = 0;
  let failCount = 0;

  // 3. Postar em cada chip (com delay aleatório entre eles)
  for (const inst of instances) {
    try {
      const body = {
        type: isVideo ? "video" : "image",
        content: media.file_url,
        caption: media.caption || "",
        allContacts: true,
        statusJidList: [],
      };

      const res = await fetch(
        `${baseUrl}/message/sendStatus/${encodeURIComponent(inst.instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evoKey },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        successCount++;
        await supabase.from("instances")
          .update({
            last_status_post: new Date().toISOString(),
            status_posts_today: (inst.last_status_date === today ? (inst.status_posts_today || 0) + 1 : 1),
            last_status_date: today,
          })
          .eq("id", inst.id);

        await supabase.from("logs").insert({
          from_number: inst.phone_number || inst.instance_name,
          to_number: "status@broadcast",
          message_content: `[STATUS] ${media.file_name || "mídia"}`,
          type: "status",
        });

        console.log(`[${ts}] [status]   ✅ ${inst.instance_name}`);
      } else {
        failCount++;
        const err = await res.text();
        console.log(`[${ts}] [status]   ❌ ${inst.instance_name}: ${err.slice(0, 150)}`);
      }

      // Delay aleatório entre chips (5-15s) para não parecer bot
      await new Promise((r) => setTimeout(r, rand(5000, 15000)));
    } catch (e) {
      failCount++;
      console.log(`[${ts}] [status]   ❌ ${inst.instance_name}: ${e.message}`);
    }
  }

  // 4. Atualizar contadores da mídia
  await supabase.from("media_queue")
    .update({
      posted: true,
      posted_count: (media.posted_count || 0) + successCount,
      last_posted_at: new Date().toISOString(),
    })
    .eq("id", media.id);

  // 5. Atualizar last_status_post no sistema
  await supabase.from("system_status")
    .update({ last_status_post: new Date().toISOString() })
    .eq("id", status.id);

  console.log(`[${ts}] [status] 🎉 Concluído: ${successCount} ok / ${failCount} falhas`);
}

// ─── CICLO PRINCIPAL ──────────────────────────────────────────
async function runCycle() {
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

    // 2. Horário ativo
    const hour = getBrazilHour();
    const start = status.start_hour ?? 8;
    const end   = status.end_hour   ?? 22;
    if (hour < start || hour >= end) {
      console.log(`[${ts}] 😴 Fora do horário (${hour}h BRT, ativo: ${start}-${end}h)`);
      return;
    }

    // 3. Configurações da Evolution API
    const { data: settingsRows } = await supabase.from("settings").select("key, value");
    const cfg = {};
    (settingsRows || []).forEach((r) => { cfg[r.key] = r.value; });

    const evoUrl = cfg["EVOLUTION_API_URL"];
    const evoKey = cfg["EVOLUTION_API_KEY"];
    if (!evoUrl || !evoKey) {
      console.log(`[${ts}] ⚠️  Evolution API não configurada`);
      return;
    }
    const baseUrl = evoUrl.replace(/\/$/, "");

    // 4. Instâncias ativas
    const { data: instances } = await supabase
      .from("instances").select("*")
      .in("status", ["open", "connected"])
      .eq("is_warmer_enabled", true);

    if (!instances || instances.length === 0) {
      console.log(`[${ts}] ⚠️  Nenhum chip ativo`);
      return;
    }

    // 5. Resetar contadores diários
    const today = new Date().toISOString().split("T")[0];
    for (const inst of instances) {
      if (inst.last_message_date !== today) {
        await supabase.from("instances")
          .update({ messages_sent_today: 0, last_message_date: today })
          .eq("id", inst.id);
        inst.messages_sent_today = 0;
      }
    }

    // 6. Decidir: grupo OU chat direto (baseado no ratio configurado)
    const intervalMs = Math.max(1, status.interval_minutes || 5) * 60 * 1000;
    const shouldRunWarmer =
      !status.last_execution ||
      (Date.now() - new Date(status.last_execution).getTime()) >= intervalMs;

    if (shouldRunWarmer) {
      const groupRatio = status.enable_group_messages ? (status.group_message_ratio || 0) : 0;
      const useGroup = Math.random() * 100 < groupRatio;

      let didSend = false;
      if (useGroup) {
        didSend = await runGroupMessageCycle(status, instances, baseUrl, evoKey, today);
        if (didSend) {
          await supabase.from("system_status")
            .update({ last_execution: new Date().toISOString() })
            .eq("id", status.id);
        }
      }

      // Se não conseguiu enviar pra grupo (ou não escolheu), tenta chat direto
      if (!didSend) {
        if (instances.length >= 2) {
          await runWarmerCycle(status, instances, baseUrl, evoKey, today);
        } else {
          console.log(`[${ts}] [warmer] ⚠️  Precisa de 2+ chips (${instances.length})`);
        }
      }
    } else {
      const remaining = Math.ceil((intervalMs - (Date.now() - new Date(status.last_execution).getTime())) / 1000);
      console.log(`[${ts}] ⏳ Aguardando intervalo (${remaining}s)`);
    }

    // 7. Rodar status posting (independente do ciclo de mensagens)
    await runStatusPostingCycle(status, instances, baseUrl, evoKey, today);

  } catch (err) {
    console.error(`[${ts}] ❌ Erro:`, err.message);
  }
}

console.log("🔥 Maturador Worker v3 iniciado (com status posting)");
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log(`   Schedule: ${CRON_SCHEDULE}`);
console.log("");

runCycle();
cron.schedule(CRON_SCHEDULE, runCycle);
