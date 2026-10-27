// DEMONSTRATION DATA ONLY — Stage 2 UI scaffolding. Replaced by real admin APIs in Stage 5.
export const DEMO = true;

export const PLANS = [
  { id: "basic", name: "PersonalOS Basic", monthlyPaise: 19900, annualPaise: 178800, monthlyCredits: 0, annualMonthlyCredits: 0, annualBonus: 0, trialDays: 30, trialCredits: 0, available: true, version: 1 },
  { id: "ai", name: "PersonalOS AI", monthlyPaise: 29900, annualPaise: 298800, monthlyCredits: 100, annualMonthlyCredits: 150, annualBonus: 50, trialDays: 30, trialCredits: 25, available: true, version: 1 },
  { id: "ai_pro", name: "PersonalOS AI Pro", monthlyPaise: 39900, annualPaise: 418800, monthlyCredits: 200, annualMonthlyCredits: 250, annualBonus: 50, trialDays: 30, trialCredits: 50, available: true, version: 1 },
];

export const SUBSCRIPTIONS = [
  { id: "sub_9F2A", user: "ananya", plan: "AI Pro", billing: "annual", status: "active", start: "2026-03-14", period: "Oct 14 – Nov 13", renewal: "2027-03-14", payment: "paid", cancel: "—" },
  { id: "sub_7C11", user: "rahul_k", plan: "AI", billing: "monthly", status: "active", start: "2026-05-02", period: "Oct 02 – Nov 01", renewal: "2026-11-02", payment: "paid", cancel: "—" },
  { id: "sub_3B90", user: "meera", plan: "Basic", billing: "monthly", status: "trialing", start: "2026-10-11", period: "Trial ends Nov 10", renewal: "2026-11-10", payment: "—", cancel: "—" },
  { id: "sub_5D44", user: "vikram", plan: "AI", billing: "annual", status: "past_due", start: "2026-01-20", period: "Oct 20 – Nov 19", renewal: "2027-01-20", payment: "failed", cancel: "—" },
  { id: "sub_1E07", user: "sara_d", plan: "AI Pro", billing: "monthly", status: "canceled", start: "2026-07-07", period: "Oct 07 – Nov 06", renewal: "—", payment: "refunded", cancel: "at period end" },
];

export const PROMOTIONS = [
  { id: "promo_diwali", name: "Diwali bonus", credits: 20, eligibility: "AI & AI Pro subscribers", start: "2026-10-18", end: "2026-10-31", limit: "1 per user", expiry: "30 days", status: "active", granted: 312 },
  { id: "promo_welcome", name: "Welcome credits", credits: 10, eligibility: "New trials", start: "2026-11-01", end: "2026-12-31", limit: "1 per user", expiry: "End of trial", status: "draft", granted: 0 },
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

export const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
