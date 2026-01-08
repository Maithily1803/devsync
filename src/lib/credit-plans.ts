export const CREDIT_PLANS = [
  { 
    id: "starter", 
    name: "Starter",
    price: 199, 
    credits: 200,
    description: "Perfect for small projects",
    features: [
      "~40 Q&A sessions",
      "~10 Meeting Issues",
      "~4 Projects",
      "* Usage varies based on how credits are spent."
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
      
      "~120 Q&A sessions",
      "~30 Meeting Issues",
      "~12 Projects",
      "* Usage varies based on how credits are spent."
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
      
      "~300 Q&A sessions",
      "~75 Meeting Issues",
      "~30 Projects",
      "* Usage varies based on how credits are spent."
    ],
    popular: false
  },
];

export const CREDIT_COSTS = {
  NEW_PROJECT: 50,
  QUESTION_ASKED: 15,
  MEETING_ISSUES_GENERATED: 20,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;