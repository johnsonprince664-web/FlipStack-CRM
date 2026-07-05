export type Profile = {
  user_id: string;
  email: string;
  display_name: string | null;
  plan: "side_hustle" | "active_flipper" | "apex";
  founder_access: boolean;
  billing_status: string;
  account_status: "active" | "warning" | "downgraded_grace" | "disabled";
  grace_started_at: string | null;
  downgraded_at: string | null;
  disabled_at: string | null;
  capacity_warning_reason: string | null;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  instagram_handle: string | null;
  snapchat_handle: string | null;
  depop_handle: string | null;
  vouch_count: number;
  total_spent: number;
  notes: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  user_id: string;
  customer_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  colorway: string | null;
  size: string | null;
  source: string | null;
  status: "available" | "pre_sold" | "sold" | "personal_rotation";
  product_cost: number;
  allocated_shipping_cost: number;
  target_sale_price: number;
  sold_price: number | null;
  deposit_paid: number;
  image_urls: string[];
  notes: string | null;
  created_at: string;
};

export type Haul = {
  id: string;
  user_id: string;
  name: string;
  agent_name: string | null;
  tracking_link: string | null;
  vendor_link: string | null;
  status: string;
  total_shipping_cost: number;
  total_weight: number;
  declared_value: number;
  carrier: string | null;
  destination_country: string | null;
  created_at: string;
};

export type Bundle = {
  id: string;
  user_id: string;
  customer_id: string | null;
  name: string;
  bundle_price: number;
  deposit_paid: number;
  status: "hold" | "paid" | "delivered" | "cancelled";
  notes: string | null;
  created_at: string;
};
