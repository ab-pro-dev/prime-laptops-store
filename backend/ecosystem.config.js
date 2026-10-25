module.exports = {
  apps: [
    {
      name: 'laptop-ecommerce-api',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 15000,
      max_memory_restart: '512M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
