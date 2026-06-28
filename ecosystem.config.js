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
        FRONTEND_URL:                  process.env.FRONTEND_URL,
        NEXT_PUBLIC_SOCKET_URL:        process.env.NEXT_PUBLIC_SOCKET_URL,
        DEMO_SUBDOMAIN:                process.env.DEMO_SUBDOMAIN,
        DEMO_SEED:                     process.env.DEMO_SEED,
        // Email
        RESEND_API_KEY:                process.env.RESEND_API_KEY,
        RESEND_FROM:                   process.env.RESEND_FROM,
        // Google OAuth
        GOOGLE_CLIENT_ID:              process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET:          process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL:           process.env.GOOGLE_CALLBACK_URL,
        // Cloudinary
        CLOUDINARY_CLOUD_NAME:         process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY:            process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET:         process.env.CLOUDINARY_API_SECRET,
        // n8n
        N8N_MARKETING_WEBHOOK_URL:     process.env.N8N_MARKETING_WEBHOOK_URL,
        N8N_CERTIFICATION_WEBHOOK_URL: process.env.N8N_CERTIFICATION_WEBHOOK_URL,
        N8N_BILLING_WEBHOOK:           process.env.N8N_BILLING_WEBHOOK,
        N8N_WEBHOOK_REVIEW_APPROVED:   process.env.N8N_WEBHOOK_REVIEW_APPROVED,
        MARKETING_CALLBACK_SECRET:     process.env.MARKETING_CALLBACK_SECRET,
        INTERNAL_API_SECRET:           process.env.INTERNAL_API_SECRET,
        // Video / AI
        CREATOMATE_API_KEY:            process.env.CREATOMATE_API_KEY,
        CREATOMATE_TEMPLATE_ID:        process.env.CREATOMATE_TEMPLATE_ID,
        GEMINI_API_KEY:                process.env.GEMINI_API_KEY,
        GROQ_API_KEY:                  process.env.GROQ_API_KEY,
        OPENAI_API_KEY:                process.env.OPENAI_API_KEY,
        // WhatsApp / Evolution
        EVOLUTION_API_URL:             process.env.EVOLUTION_API_URL,
        EVOLUTION_INSTANCE:            process.env.EVOLUTION_INSTANCE,
        EVOLUTION_API_KEY:             process.env.EVOLUTION_API_KEY,
        EVOLUTION_WEBHOOK_TOKEN:       process.env.EVOLUTION_WEBHOOK_TOKEN,
        // Misc
        SUPERADMIN_EMAIL:              process.env.SUPERADMIN_EMAIL,
        SUPERADMIN_SECRET:             process.env.SUPERADMIN_SECRET,
        QR_ENGINE_URL:                 process.env.QR_ENGINE_URL,
        POSBRIDGE_SECRET:              process.env.POSBRIDGE_SECRET,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
}
