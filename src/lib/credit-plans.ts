export const CREDIT_PLANS = [
  { 
    id: "starter", 
    name: "Starter",
    price: 199, 
    credits: 200,
    description: "Perfect for small projects",
    features: [
      "200 AI Credits",
      "~20 Q&A sessions",
      "~10 Meeting issues",

    ],
    popular: false
  },
  { 
    id: "pro", 
    name: "Professional",
    price: 499, 
    credits: 600,
    description: "Best for growing teams",
    features: [
      "600 AI Credits",
      "~60 Q&A sessions",
      "~30 Meeting Issues",
    ],
    popular: true
  },
  { 
    id: "power", 
    name: "Power User",
    price: 999, 
    credits: 1500,
    description: "For power users and large teams",
    features: [
      "1500 AI Credits",
      "~150 Q&A sessions",
      "~75 Meeting Issues",

    ],
    popular: false
  },
];

export const CREDIT_COSTS = {
  QUESTION_ASKED: 10,
  MEETING_TRANSCRIBED: 20,
  EMBEDDING_GENERATED: 5,
  COMMIT_ANALYSIS: 2,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
