const cron = require("node-cron");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://dados-supabase.rt19gx.easypanel.host";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const WARMER_CRON_URL = `${SUPABASE_URL}/functions/v1/warmer-cron`;

// Intervalo de disparo (a edge function decide se executa ou aguarda)
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "* * * * *"; // todo minuto

async function callWarmerCron() {
  const ts = new Date().toISOString();
  try {
    const res = await fetch(WARMER_CRON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    const status = data?.status || "unknown";

    if (status === "success") {
      console.log(`[${ts}] ✅ Enviado: ${data.sender} → ${data.receiver} | "${data.message}"`);
    } else if (status === "interval_not_reached") {
      console.log(`[${ts}] ⏳ Intervalo não atingido — aguardando ${data.remainingSeconds}s`);
    } else if (status === "sleeping") {
      console.log(`[${ts}] 😴 Fora do horário ativo (${data.hour}h BRT)`);
    } else if (status === "paused") {
      console.log(`[${ts}] ⏸  Sistema pausado`);
    } else {
      console.log(`[${ts}] ℹ️  Status: ${status}`, JSON.stringify(data).slice(0, 200));
    }
  } catch (err) {
    console.error(`[${ts}] ❌ Erro ao chamar warmer-cron:`, err.message);
  }
}

console.log(`🚀 Maturador Worker iniciado — schedule: "${CRON_SCHEDULE}"`);
console.log(`   Endpoint: ${WARMER_CRON_URL}`);

// Dispara imediatamente ao iniciar
callWarmerCron();

// Depois roda no schedule configurado
cron.schedule(CRON_SCHEDULE, callWarmerCron);
