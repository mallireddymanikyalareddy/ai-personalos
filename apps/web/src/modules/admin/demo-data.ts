// DEMONSTRATION DATA ONLY — Stage 2 UI scaffolding. Replaced by real admin APIs in Stage 5.
export const DEMO = true;

export const PLANS = [
  { id: "basic", name: "PersonalOS Basic", monthlyPaise: 19900, annualPaise: 178800, monthlyCredits: 0, annualMonthlyCredits: 0, annualBonus: 0, trialDays: 30, trialCredits: 0, available: true, version: 1 },
  { id: "ai", name: "PersonalOS AI", monthlyPaise: 29900, annualPaise: 298800, monthlyCredits: 100, annualMonthlyCredits: 150, annualBonus: 50, trialDays: 30, trialCredits: 25, available: true, version: 1 },
  { id: "ai_pro", name: "PersonalOS AI Pro", monthlyPaise: 39900, annualPaise: 418800, monthlyCredits: 200, annualMonthlyCredits: 250, annualBonus: 50, trialDays: 30, trialCredits: 50, available: true, version: 1 },
];

export const ACTION_PRICING = [
  { action: "quick_question", label: "Quick AI question", credits: "1", model: "gpt-6-luna", maxOutput: 600 },
  { action: "task_improve", label: "Create or improve task", credits: "1", model: "gpt-6-luna", maxOutput: 400 },
  { action: "task_priorities", label: "Suggest task priorities", credits: "1", model: "gpt-6-luna", maxOutput: 600 },
  { action: "task_breakdown", label: "Break down task", credits: "2", model: "gpt-6-luna", maxOutput: 800 },
  { action: "daily_plan", label: "Generate daily plan", credits: "2", model: "gpt-6-luna", maxOutput: 900 },
  { action: "habit_suggest", label: "Suggest a habit or routine", credits: "2", model: "gpt-6-luna", maxOutput: 600 },
  { action: "note_summary", label: "Summarize note", credits: "2", model: "gpt-6-luna", maxOutput: 700 },
  { action: "journal_summary", label: "Summarize journal entry", credits: "2", model: "gpt-6-luna", maxOutput: 700 },
  { action: "goal_plan", label: "Goal action plan", credits: "3", model: "gpt-6-luna", maxOutput: 1200 },
  { action: "weekly_review", label: "Weekly productivity review", credits: "3", model: "gpt-6-luna", maxOutput: 1200 },
  { action: "document_analysis", label: "Document analysis", credits: "3–8", model: "gpt-6-luna", maxOutput: 2000 },
  { action: "meeting_analysis", label: "Meeting analysis", credits: "3–6", model: "gpt-6-luna", maxOutput: 1800 },
  { action: "complex_planning", label: "Complex multi-step planning", credits: "5", model: "gpt-6-luna", maxOutput: 2500 },
];

export const USERS = [
  { id: "u_1001", handle: "ananya", email: "ananya@example.com", plan: "PersonalOS AI Pro", billing: "annual", status: "active", available: 212, reserved: 3, joined: "2026-03-14" },
  { id: "u_1002", handle: "rahul_k", email: "rahul@example.com", plan: "PersonalOS AI", billing: "monthly", status: "active", available: 41, reserved: 0, joined: "2026-05-02" },
  { id: "u_1003", handle: "meera", email: "meera@example.com", plan: "PersonalOS Basic", billing: "monthly", status: "trial", available: 0, reserved: 0, joined: "2026-10-11" },
  { id: "u_1004", handle: "vikram", email: "vikram@example.com", plan: "PersonalOS AI", billing: "annual", status: "past_due", available: 8, reserved: 2, joined: "2026-01-20" },
  { id: "u_1005", handle: "sara_d", email: "sara@example.com", plan: "PersonalOS AI Pro", billing: "monthly", status: "suspended", available: 120, reserved: 0, joined: "2026-07-07" },
];

export const SUBSCRIPTIONS = [
  { id: "sub_9F2A", user: "ananya", plan: "AI Pro", billing: "annual", status: "active", start: "2026-03-14", period: "Oct 14 – Nov 13", renewal: "2027-03-14", payment: "paid", cancel: "—" },
  { id: "sub_7C11", user: "rahul_k", plan: "AI", billing: "monthly", status: "active", start: "2026-05-02", period: "Oct 02 – Nov 01", renewal: "2026-11-02", payment: "paid", cancel: "—" },
  { id: "sub_3B90", user: "meera", plan: "Basic", billing: "monthly", status: "trialing", start: "2026-10-11", period: "Trial ends Nov 10", renewal: "2026-11-10", payment: "—", cancel: "—" },
  { id: "sub_5D44", user: "vikram", plan: "AI", billing: "annual", status: "past_due", start: "2026-01-20", period: "Oct 20 – Nov 19", renewal: "2027-01-20", payment: "failed", cancel: "—" },
  { id: "sub_1E07", user: "sara_d", plan: "AI Pro", billing: "monthly", status: "canceled", start: "2026-07-07", period: "Oct 07 – Nov 06", renewal: "—", payment: "refunded", cancel: "at period end" },
];

export const LEDGER = [
  { id: "ctx_8812", user: "ananya", type: "grant", amount: 250, reason: "Annual monthly allowance (Oct)", at: "2026-10-14 00:00" },
  { id: "ctx_8813", user: "ananya", type: "charge", amount: -2, reason: "Generate daily plan", at: "2026-10-24 08:12" },
  { id: "ctx_8814", user: "rahul_k", type: "reserve", amount: -3, reason: "Goal action plan", at: "2026-10-25 19:40" },
  { id: "ctx_8815", user: "rahul_k", type: "release", amount: 3, reason: "Provider error — reservation released", at: "2026-10-25 19:40" },
  { id: "ctx_8816", user: "vikram", type: "promo", amount: 20, reason: "Diwali campaign", at: "2026-10-20 10:00" },
];

export const USAGE = [
  { id: "req_a1", user: "ananya", action: "daily_plan", provider: "openai", model: "gpt-6-luna", inTok: 1820, outTok: 640, reserved: 2, charged: 2, costPaise: 31, ms: 2140, status: "succeeded", at: "08:12" },
  { id: "req_a2", user: "rahul_k", action: "goal_plan", provider: "openai", model: "gpt-6-luna", inTok: 2410, outTok: 0, reserved: 3, charged: 0, costPaise: 0, ms: 30000, status: "failed", at: "19:40" },
  { id: "req_a3", user: "vikram", action: "note_summary", provider: "openai", model: "gpt-6-luna", inTok: 3110, outTok: 420, reserved: 2, charged: 2, costPaise: 38, ms: 1890, status: "succeeded", at: "21:05" },
  { id: "req_a4", user: "ananya", action: "meeting_analysis", provider: "openai", model: "gpt-6-luna", inTok: 9800, outTok: 1500, reserved: 6, charged: 5, costPaise: 142, ms: 6400, status: "reconciliation_required", at: "22:31" },
];

export const TREND = [
  { day: "Oct 20", requests: 412, credits: 790, costPaise: 7120 },
  { day: "Oct 21", requests: 455, credits: 860, costPaise: 7790 },
  { day: "Oct 22", requests: 498, credits: 940, costPaise: 8450 },
  { day: "Oct 23", requests: 471, credits: 905, costPaise: 8110 },
  { day: "Oct 24", requests: 530, credits: 1010, costPaise: 9020 },
  { day: "Oct 25", requests: 562, credits: 1080, costPaise: 9610 },
  { day: "Oct 26", requests: 590, credits: 1135, costPaise: 10120 },
];

export const PROMOTIONS = [
  { id: "promo_diwali", name: "Diwali bonus", credits: 20, eligibility: "AI & AI Pro subscribers", start: "2026-10-18", end: "2026-10-31", limit: "1 per user", expiry: "30 days", status: "active", granted: 312 },
  { id: "promo_welcome", name: "Welcome credits", credits: 10, eligibility: "New trials", start: "2026-11-01", end: "2026-12-31", limit: "1 per user", expiry: "End of trial", status: "draft", granted: 0 },
];

export const AUDIT = [
  { id: "aud_501", admin: "billing.priya", role: "Billing Admin", action: "credit.grant", target: "user u_1004", reason: "Goodwill after failed renewal", outcome: "success", at: "2026-10-20 10:02", requestId: "rq_7f1c" },
  { id: "aud_502", admin: "ops.arjun", role: "AI Operations Admin", action: "pricing.publish", target: "pricing v3", reason: "Raise meeting analysis max", outcome: "success", at: "2026-10-22 16:45", requestId: "rq_81aa" },
  { id: "aud_503", admin: "support.neha", role: "Support Admin", action: "user.suspend", target: "user u_1005", reason: "Chargeback investigation", outcome: "success", at: "2026-10-23 11:10", requestId: "rq_9b20" },
  { id: "aud_504", admin: "analyst.dev", role: "Read-only Analyst", action: "credit.grant", target: "user u_1002", reason: "—", outcome: "denied", at: "2026-10-24 09:00", requestId: "rq_a003" },
];

export const SETTINGS = {
  providerStatus: [
    { provider: "OpenAI (GPT 6 Luna)", status: "configured — no credits", tone: "warning" },
    { provider: "Razorpay", status: "not configured", tone: "danger" },
    { provider: "Mock AI provider", status: "available in tests only", tone: "neutral" },
  ],
  defaultModel: "gpt-6-luna",
  maxInputTokens: 12000,
  maxRequestsPerMinute: 20,
  monthlySpendAlertPaise: 500000,
  lowCreditThreshold: 10,
  resetPolicy: "Included credits reset each entitlement period; unused included credits do not carry over.",
  trialDays: 30,
  flags: [
    { key: "ai_confirmation_modal", on: true },
    { key: "annual_bonus_credits", on: true },
    { key: "promotions", on: false },
  ],
};

export const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
