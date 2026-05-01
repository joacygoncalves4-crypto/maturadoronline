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
        SUPABASE_URL: "https://htshmcvuwxxmlvkifpex.supabase.co",
        SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2htY3Z1d3h4bWx2a2lmcGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDAzMjQsImV4cCI6MjA4NDA3NjMyNH0.ZUCrgMScECMuccgWt5q6sNwKPi3hEaUd_EkT7fSAIkE",
        CRON_SCHEDULE: "* * * * *",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/maturador/worker-error.log",
      out_file: "/var/log/maturador/worker-out.log",
    },
  ],
};
