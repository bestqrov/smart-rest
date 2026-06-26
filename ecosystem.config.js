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
        DATABASE_URL:                  process.env.DATABASE_URL,
        JWT_SECRET:                    process.env.JWT_SECRET,
        PORT:                          process.env.PORT || 4000,
        N8N_MARKETING_WEBHOOK_URL:     process.env.N8N_MARKETING_WEBHOOK_URL,
        N8N_CERTIFICATION_WEBHOOK_URL: process.env.N8N_CERTIFICATION_WEBHOOK_URL,
        N8N_BILLING_WEBHOOK:           process.env.N8N_BILLING_WEBHOOK,
        N8N_WEBHOOK_REVIEW_APPROVED:   process.env.N8N_WEBHOOK_REVIEW_APPROVED,
        MARKETING_CALLBACK_SECRET:     process.env.MARKETING_CALLBACK_SECRET,
        CREATOMATE_API_KEY:            process.env.CREATOMATE_API_KEY,
        CREATOMATE_TEMPLATE_ID:        process.env.CREATOMATE_TEMPLATE_ID,
        EVOLUTION_WEBHOOK_TOKEN:       process.env.EVOLUTION_WEBHOOK_TOKEN,
        NEXT_PUBLIC_SOCKET_URL:        process.env.NEXT_PUBLIC_SOCKET_URL,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
}
