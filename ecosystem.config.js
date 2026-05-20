module.exports = {
  apps: [
    {
      name: 'smart-menu-api',
      script: 'npm',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,
      merge_logs: true,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        // supply DATABASE_URL and JWT_SECRET via environment on the server
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        PORT: process.env.PORT || 4000
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
}
