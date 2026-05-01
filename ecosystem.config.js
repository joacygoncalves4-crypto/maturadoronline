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
        SUPABASE_ANON_KEY: "COLE_SEU_ANON_KEY_AQUI",
        CRON_SCHEDULE: "* * * * *",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/maturador/worker-error.log",
      out_file: "/var/log/maturador/worker-out.log",
    },
  ],
};
