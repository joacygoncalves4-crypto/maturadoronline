module.exports = {
  apps: [
    {
      name: "maturador-worker",
      script: "./worker/index.js",
      cwd: "/var/www/maturador",
      watch: false,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        SUPABASE_URL: "https://dados-supabase.rt19gx.easypanel.host",
        SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
        CRON_SCHEDULE: "* * * * *",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/maturador/worker-error.log",
      out_file: "/var/log/maturador/worker-out.log",
    },
  ],
};
