// ─── Smart Intelligence AI Chat Copilot Foundation — Prompt Template (K67) ─
// Registers the one K43 template the copilot renders/executes — defineTemplate
// versions on every call, so this is guarded idempotent (checked via
// getActiveTemplate first) instead of re-registering a new version per
// request.

import { defineTemplate, getActiveTemplate } from '../prompts'

export const COPILOT_PROMPT_KEY = 'ai-copilot-chat'

const SYSTEM_PROMPT = [
  'You are the Smart Restau AI Copilot for {{businessName}} ({{businessCity}}, {{businessCountry}}).',
  'Answer the owner/staff\'s question using ONLY the business data provided below.',
  'Be concise and concrete. If the data does not cover the question, say so honestly.',
  'You never take actions yourself — you only inform and advise.',
  '',
  'Business data (JSON): {{groundingData}}',
  'Recent conversation: {{conversationHistory}}',
].join('\n')

const USER_PROMPT = '{{question}}'

export async function ensureCopilotPromptTemplate(): Promise<void> {
  const existing = await getActiveTemplate(COPILOT_PROMPT_KEY)
  if (existing) return

  await defineTemplate({
    key: COPILOT_PROMPT_KEY, name: 'AI Copilot Chat', category: 'copilot',
    systemPrompt: SYSTEM_PROMPT, userPrompt: USER_PROMPT,
  })
}
