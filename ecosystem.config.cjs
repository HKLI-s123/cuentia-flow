/**
 * PM2 Ecosystem Configuration
 * 
 * Procesos:
 *   1. cuentia-app    → SvelteKit (adapter-node) en puerto 3000
 *   2. cuentia-worker → Worker (cobrador IA, refacturación, WhatsApp) en puerto 3847
 * 
 * Uso:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */
module.exports = {
  apps: [
    {
      name: 'cuentia-app',
      script: 'build/index.js',
      cwd: '/home/cuentia/apps/cuentia-flow',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ORIGIN: 'https://flow.cuentia.mx'
      },
      env_file: '/home/cuentia/apps/cuentia-flow/.env',
      instances: 1,            // 1 instancia (Baileys necesita singleton)
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/cuentia/logs/app-error.log',
      out_file: '/home/cuentia/logs/app-out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'cuentia-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts',
      cwd: '/home/cuentia/apps/cuentia-flow',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '/home/cuentia/apps/cuentia-flow/.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/cuentia/logs/worker-error.log',
      out_file: '/home/cuentia/logs/worker-out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000,
    }
  ]
};
