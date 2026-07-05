export type PlanId = "side_hustle" | "active_flipper" | "apex";

export const PLANS = {
  side_hustle: {
    name: "Side Hustle",
    price: "$0",
    accountLoadLimit: 20,
    haulLimit: 2,
    incomingItemLimit: 10,
    features: ["Manual CRM", "Manual revenue tracking", "Social handles", "Manual haul links"]
  },
  active_flipper: {
    name: "Active Flipper",
    price: "$19.99/mo",
    yearly: "$149/yr",
    accountLoadLimit: 250,
    haulLimit: 5,
    incomingItemLimit: 250,
    features: ["Everything in Free", "Shippo labels", "Haul notifications", "Customs risk tool"]
  },
  apex: {
    name: "Apex / Power Seller",
    price: "$44.99/mo",
    yearly: "$399/yr",
    accountLoadLimit: Infinity,
    haulLimit: Infinity,
    incomingItemLimit: Infinity,
    features: ["Everything in Premium", "Unlimited load", "AI spacing simulator", "Marketplace sync", "Advanced exports"]
  }
} as const;

export function canUseFeature(plan: PlanId, feature: "shippo" | "risk" | "spacing" | "marketplace" | "advanced_exports") {
  if (plan === "apex") return true;
  if (plan === "active_flipper") return ["shippo", "risk"].includes(feature);
  return false;
}

export function getPlanLimit(plan: PlanId) {
  return PLANS[plan] || PLANS.side_hustle;
}
