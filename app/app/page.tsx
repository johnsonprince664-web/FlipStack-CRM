"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Customer, InventoryItem, Haul, Bundle, Profile } from "@/lib/types";
import { PLANS, canUseFeature, PlanId } from "@/lib/plans";

type View = "dashboard" | "inventory" | "customers" | "orders" | "hauls" | "shipping" | "reports" | "plans";
type DashboardRange = "this_month" | "last_month" | "all_time";

const defaultItem = {
  name: "",
  brand: "",
  category: "",
  colorway: "",
  size: "",
  source: "Agent",
  status: "available",
  product_cost: 0,
  allocated_shipping_cost: 0,
  target_sale_price: 0,
  deposit_paid: 0,
  notes: ""
};

export default function AppPage() {
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [hauls, setHauls] = useState<Haul[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedShippingIds, setSelectedShippingIds] = useState<string[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [revenueGoal, setRevenueGoal] = useState(1000);
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("this_month");

  const disabled = profile?.account_status === "disabled";
  const plan = (profile?.plan || "side_hustle") as PlanId;

  async function refresh() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
      window.location.href = "/login";
      return;
    }

    setUserId(session.user.id);
    setAccessToken(session.access_token);

    const [profileRes, customersRes, itemsRes, haulsRes, bundlesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", session.user.id).single(),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_items").select("*").order("created_at", { ascending: false }),
      supabase.from("hauls").select("*").order("created_at", { ascending: false }),
      supabase.from("bundles").select("*").order("created_at", { ascending: false })
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    setCustomers((customersRes.data || []) as Customer[]);
    setItems((itemsRes.data || []) as InventoryItem[]);
    setHauls((haulsRes.data || []) as Haul[]);
    setBundles((bundlesRes.data || []) as Bundle[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthKey = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, "0")}`;
  const dashboardPeriodKey = dashboardRange === "last_month" ? lastMonthKey : dashboardRange === "all_time" ? "all-time" : thisMonthKey;
  const revenueGoalStorageKey = `flipstack_revenue_goal_${dashboardPeriodKey}`;

  const dashboardRangeLabel = dashboardRange === "all_time"
    ? "All-time Dashboard"
    : dashboardRange === "last_month"
      ? `${lastMonthStart.toLocaleString(undefined, { month: "long", year: "numeric" })} Dashboard`
      : `${today.toLocaleString(undefined, { month: "long", year: "numeric" })} Dashboard`;

  function rowDate(row: any) {
    const value = row?.sold_at || row?.paid_at || row?.delivered_at || row?.created_at || row?.updated_at;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function isInDashboardRange(row: any) {
    if (dashboardRange === "all_time") return true;
    const date = rowDate(row);
    if (!date) return false;
    const start = dashboardRange === "last_month" ? lastMonthStart : thisMonthStart;
    const end = dashboardRange === "last_month" ? thisMonthStart : nextMonthStart;
    return date >= start && date < end;
  }

  useEffect(() => {
    const savedGoal = window.localStorage.getItem(revenueGoalStorageKey);
    if (savedGoal && !Number.isNaN(Number(savedGoal))) {
      setRevenueGoal(Number(savedGoal));
    } else {
      setRevenueGoal(1000);
    }
  }, [revenueGoalStorageKey]);

  const activeInventoryCount = items.filter(i => i.status !== "sold").length;
  const incomingHaulCount = hauls.filter(h => h.status !== "received" && h.status !== "cancelled").length;
  const incomingHaulItems = hauls.reduce((sum, h) => sum + Number((h as any).item_count || 0), 0);
  const accountLoad = activeInventoryCount + incomingHaulItems;

  const revenue = items
    .filter(i => i.status !== "personal_rotation")
    .reduce((sum, i) => sum + Number(i.sold_price || i.target_sale_price || 0), 0)
    + bundles.reduce((sum, b) => sum + Number(b.bundle_price || 0), 0);

  const capital = items.reduce((sum, i) => sum + Number(i.product_cost || 0) + Number(i.allocated_shipping_cost || 0), 0);
  const deposits = items.reduce((sum, i) => sum + Number(i.deposit_paid || 0), 0)
    + bundles.reduce((sum, b) => sum + Number(b.deposit_paid || 0), 0);
  const profit = revenue - capital;

  const dashboardItems = items.filter(isInDashboardRange);
  const dashboardBundles = bundles.filter(isInDashboardRange);
  const dashboardHauls = hauls.filter(isInDashboardRange);

  const dashboardRevenue = dashboardItems
    .filter(i => i.status !== "personal_rotation")
    .reduce((sum, i) => sum + Number(i.sold_price || i.target_sale_price || 0), 0)
    + dashboardBundles.reduce((sum, b) => sum + Number(b.bundle_price || 0), 0);

  const dashboardCapital = dashboardItems.reduce((sum, i) => sum + Number(i.product_cost || 0) + Number(i.allocated_shipping_cost || 0), 0);
  const dashboardDeposits = dashboardItems.reduce((sum, i) => sum + Number(i.deposit_paid || 0), 0)
    + dashboardBundles.reduce((sum, b) => sum + Number(b.deposit_paid || 0), 0);
  const dashboardProfit = dashboardRevenue - dashboardCapital;
  const dashboardActiveHolds = dashboardItems.filter(i => i.status === "pre_sold");
  const revenueGoalProgress = revenueGoal > 0 ? Math.min(100, (dashboardRevenue / revenueGoal) * 100) : 0;

  function updateRevenueGoal(value: number) {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    setRevenueGoal(safeValue);
    window.localStorage.setItem(revenueGoalStorageKey, String(safeValue));
  }

  const filteredItems = items.filter(item => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [item.name, item.brand, item.category, item.colorway, item.size, item.status].some(v => (v || "").toLowerCase().includes(q));
  });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function createCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const payload = {
      name: String(form.get("name") || ""),
      instagram_handle: String(form.get("instagram_handle") || ""),
      snapchat_handle: String(form.get("snapchat_handle") || ""),
      depop_handle: String(form.get("depop_handle") || ""),
      notes: String(form.get("notes") || ""),
    };

    try {
      if (editingCustomer?.id) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);

        if (error) throw error;

        setMessage("Customer updated.");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(payload);

        if (error) throw error;

        setMessage("Customer added.");
      }

      const { data, error: reloadError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (reloadError) throw reloadError;

      setCustomers((data || []) as Customer[]);
      setEditingCustomer(null);
      setShowCustomerForm(false);
      e.currentTarget.reset();
    } catch (err: any) {
      setMessage(err.message || "Could not save customer.");
    }
  }

  async function deleteCustomer(customerId: string) {
    const confirmed = window.confirm(
      "Delete this customer? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;

      const { data, error: reloadError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (reloadError) throw reloadError;

      setCustomers((data || []) as Customer[]);
      if (selectedCustomer?.id === customerId) setSelectedCustomer(null);
      setMessage("Customer deleted.");
    } catch (err: any) {
      setMessage(err.message || "Could not delete customer.");
    }
  }
  async function uploadItemImages(itemId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const uploadedUrls: string[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${itemId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inventory-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("inventory-images").getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }

    const existing = editingItem?.image_urls || [];
    await supabase.from("inventory_items").update({
      image_urls: [...existing, ...uploadedUrls]
    }).eq("id", itemId);
  }


  async function saveItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return setMessage("Account disabled. Rectify your limit first.");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      brand: String(fd.get("brand") || ""),
      category: String(fd.get("category") || ""),
      colorway: String(fd.get("colorway") || ""),
      size: String(fd.get("size") || ""),
      source: String(fd.get("source") || ""),
      status: String(fd.get("status") || "available"),
      customer_id: String(fd.get("customer_id") || "") || null,
      product_cost: Number(fd.get("product_cost") || 0),
      allocated_shipping_cost: Number(fd.get("allocated_shipping_cost") || 0),
      target_sale_price: Number(fd.get("target_sale_price") || 0),
      deposit_paid: Number(fd.get("deposit_paid") || 0),
      notes: String(fd.get("notes") || "")
    };

    let savedId = editingItem?.id || "";
    let error: any = null;

    if (editingItem) {
      const result = await supabase.from("inventory_items").update(payload).eq("id", editingItem.id);
      error = result.error;
    } else {
      const result = await supabase.from("inventory_items").insert(payload).select("id").single();
      error = result.error;
      savedId = result.data?.id || "";
    }

    if (error) setMessage(error.message);
    else {
      try {
        const imageInput = e.currentTarget.elements.namedItem("images") as HTMLInputElement | null;
        await uploadItemImages(savedId, imageInput?.files || null);
      } catch (imageError: any) {
        setMessage(`Item saved, but image upload failed: ${imageError.message}`);
        refresh();
        return;
      }
      setMessage(editingItem ? "Item updated." : "Item added.");
      setEditingItem(null);
      e.currentTarget.reset();
      refresh();
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) setMessage(error.message);
    else refresh();
  }

  async function allocateShipping() {
    if (!selectedShippingIds.length) return setMessage("Select items first.");
    const perItem = shippingCost / selectedShippingIds.length;
    const { error } = await supabase.from("inventory_items").update({ allocated_shipping_cost: perItem }).in("id", selectedShippingIds);
    if (error) setMessage(error.message);
    else {
      setMessage(`Shipping allocated: $${perItem.toFixed(2)} per selected item.`);
      setSelectedShippingIds([]);
      refresh();
    }
  }

  async function createHaul(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return setMessage("Account disabled. Rectify your limit first.");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      agent_name: String(fd.get("agent_name") || ""),
      tracking_link: String(fd.get("tracking_link") || ""),
      vendor_link: String(fd.get("vendor_link") || ""),
      status: String(fd.get("status") || "warehouse"),
      total_shipping_cost: Number(fd.get("total_shipping_cost") || 0),
      total_weight: Number(fd.get("total_weight") || 0),
      declared_value: Number(fd.get("declared_value") || 0),
      carrier: String(fd.get("carrier") || ""),
      destination_country: String(fd.get("destination_country") || "")
    };
    const { error } = await supabase.from("hauls").insert(payload);
    if (error) setMessage(error.message);
    else {
      setMessage("Haul saved.");
      e.currentTarget.reset();
      refresh();
    }
  }

  async function createBundle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return setMessage("Account disabled. Rectify your limit first.");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      customer_id: String(fd.get("customer_id") || "") || null,
      bundle_price: Number(fd.get("bundle_price") || 0),
      deposit_paid: Number(fd.get("deposit_paid") || 0),
      status: String(fd.get("status") || "hold"),
      notes: String(fd.get("notes") || "")
    };
    const { error } = await supabase.from("bundles").insert(payload);
    if (error) setMessage(error.message);
    else {
      setMessage("Bundle saved.");
      e.currentTarget.reset();
      refresh();
    }
  }

  async function redeemFounderAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") || "");
    const res = await fetch("/api/founder/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code })
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not redeem.");
    setMessage("Founder access unlocked.");
    refresh();
  }
async function redeemPartnerAccess(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const code = String(new FormData(e.currentTarget).get("code") || "");

  const res = await fetch("/api/partner/redeem", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code }),
  });

  const json = await res.json();

  if (!res.ok) {
    return setMessage(json.error || "Could not redeem partner code.");
  }

  setMessage("Partner code redeemed. Active Flipper unlocked free for 1 year.");
  refresh();
}
<div className="card card-pad full">
  <h3>Partner access</h3>
  <p className="muted">
    Redeem a partner code to unlock Active Flipper free for 1 year.
  </p>

  <form className="form-grid" onSubmit={redeemPartnerAccess}>
    <label className="full">
      Partner code
      <input name="code" placeholder="Enter partner code" />
    </label>

    <button className="btn btn-primary" type="submit">
      Redeem partner code
    </button>
  </form>
</div>
  async function seedFounderData() {
    const res = await fetch("/api/founder/seed-demo", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not seed data.");
    setMessage("Starter data added to your account.");
    refresh();
  }

  function createCheckout(planTarget: string, interval: "monthly" | "yearly") {
  const planKey = `${String(planTarget)}_${interval}`.toLowerCase();

  const planMap: Record<string, string> = {
    active_flipper_monthly: "active_monthly",
    active_flipper_yearly: "active_yearly",
    active_monthly: "active_monthly",
    active_yearly: "active_yearly",

    apex_power_monthly: "apex_monthly",
    apex_power_yearly: "apex_yearly",
    apex_monthly: "apex_monthly",
    apex_yearly: "apex_yearly",
  };

  const checkoutPlan = planMap[planKey];

  if (!checkoutPlan) {
    setMessage(`Invalid plan selected: ${planKey}`);
    return;
  }

  window.location.href = `/checkout?plan=${checkoutPlan}`;
}

  async function getShippoRates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canUseFeature(plan, "shippo") && !profile?.founder_access) return setMessage("Shippo labels require Active Flipper or Apex.");
    const fd = new FormData(e.currentTarget);
    const payload = {
      address_to: {
        name: String(fd.get("to_name") || ""),
        street1: String(fd.get("street1") || ""),
        city: String(fd.get("city") || ""),
        state: String(fd.get("state") || ""),
        zip: String(fd.get("zip") || ""),
        country: "US",
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || "")
      },
      parcel: {
        length: String(fd.get("length") || "12"),
        width: String(fd.get("width") || "9"),
        height: String(fd.get("height") || "2"),
        distance_unit: "in",
        weight: String(fd.get("weight") || "1"),
        mass_unit: "lb"
      }
    };
    const res = await fetch("/api/shippo/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Could not get rates.");
    else setMessage(`Rates ready. First rate: ${json.rates?.[0]?.provider || "carrier"} ${json.rates?.[0]?.amount || ""}`);
  }

  if (loading) return <main className="auth-page"><div className="card auth-card">Loading FlipStack...</div></main>;

  const nav: [View, string][] = [
    ["dashboard", "Dashboard"],
    ["inventory", "Inventory"],
    ["customers", "Customers"],
    ["orders", "Orders"],
    ["hauls", "Hauls"],
    ["shipping", "Shippo Labels"],
    ["reports", "Reports"],
    ["plans", "Plans"]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/flipstack-app-icon.png" alt="FlipStack" />
          <div>
            <p className="eyebrow">Nova Labs</p>
            <h1>FlipStack</h1>
          </div>
        </div>
        <nav className="nav">
          {nav.map(([id, label]) => (
            <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        <div className="card card-pad" style={{marginTop: 18}}>
          <p className="eyebrow">Current plan</p>
          <h3>{PLANS[plan]?.name}</h3>
          <p className="muted">{accountLoad} account load / {Number.isFinite(PLANS[plan].accountLoadLimit) ? PLANS[plan].accountLoadLimit : "Unlimited"}</p>
          <button type="button" className="btn btn-secondary" onClick={signOut}>Logout</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Reseller Command Center</p>
            <h2>{nav.find(n => n[0] === view)?.[1]}</h2>
          </div>
          <input style={{maxWidth: 360}} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, buyers, brands..." />
        </header>

        {message && <div className="warning-banner">{message}</div>}
        {profile?.account_status !== "active" && (
          <div className={profile?.account_status === "disabled" ? "warning-banner danger" : "warning-banner"}>
            <strong>Account status: {profile?.account_status}</strong>
            <p className="muted">{profile?.capacity_warning_reason || "Your account needs attention."}</p>
          </div>
        )}

        {view === "dashboard" && (
          <section className="grid">
            <div className="card card-pad dashboard-hero">
              <img className="logo-lockup" src="/assets/flipstack-app-lockup-transparent.png" alt="FlipStack" />
              <div>
                <h2>Welcome to your live FlipStack workspace.</h2>
                <p className="muted">This dashboard is clickable and monthly by default: jump into inventory, customer ledgers, hauls, orders, and reports from here.</p>
              </div>
              <div className="dashboard-quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingItem(null);
                    setShowInventoryForm(true);
                    setView("inventory");
                  }}
                >
                  + Add inventory
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingCustomer(null);
                    setShowCustomerForm(true);
                    setView("customers");
                  }}
                >
                  + Add customer
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setView("orders")}>Create order</button>
                <button type="button" className="btn btn-secondary" onClick={() => setView("hauls")}>Add haul</button>
              </div>
            </div>

            <div className="card card-pad dashboard-period-card">
              <div>
                <p className="eyebrow">Dashboard period</p>
                <h3>{dashboardRangeLabel}</h3>
                <p className="muted">Dashboard numbers reset by month. Reports still keep all-time totals.</p>
              </div>
              <div className="period-toggle-group" aria-label="Dashboard period filter">
                <button
                  type="button"
                  className={dashboardRange === "this_month" ? "btn btn-primary compact-action" : "btn btn-secondary compact-action"}
                  onClick={() => setDashboardRange("this_month")}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className={dashboardRange === "last_month" ? "btn btn-primary compact-action" : "btn btn-secondary compact-action"}
                  onClick={() => setDashboardRange("last_month")}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  className={dashboardRange === "all_time" ? "btn btn-primary compact-action" : "btn btn-secondary compact-action"}
                  onClick={() => setDashboardRange("all_time")}
                >
                  All Time
                </button>
              </div>
            </div>

            <div className="metric-grid">
              <button type="button" className="card metric dashboard-click-card" onClick={() => setView("reports")}>
                <span>Projected Revenue</span>
                <strong>${dashboardRevenue.toFixed(2)}</strong>
                <small>Open reports</small>
              </button>
              <button type="button" className="card metric dashboard-click-card" onClick={() => setView("reports")}>
                <span>Capital Out</span>
                <strong>${dashboardCapital.toFixed(2)}</strong>
                <small>Open reports</small>
              </button>
              <button type="button" className="card metric dashboard-click-card" onClick={() => setView("reports")}>
                <span>Projected Profit</span>
                <strong className="good">${dashboardProfit.toFixed(2)}</strong>
                <small>Open reports</small>
              </button>
              <button type="button" className="card metric dashboard-click-card" onClick={() => setView("customers")}>
                <span>Deposits</span>
                <strong>${dashboardDeposits.toFixed(2)}</strong>
                <small>Open customers</small>
              </button>
            </div>

            <div className="card card-pad revenue-goal-card">
              <div className="row-head">
                <div>
                  <h3>Revenue goal</h3>
                  <p className="muted">${dashboardRevenue.toFixed(2)} of ${revenueGoal.toFixed(2)} projected revenue for this period</p>
                </div>
                <label className="revenue-goal-input">
                  Goal
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={revenueGoal}
                    onChange={(e) => updateRevenueGoal(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="goal-bar" aria-label="Revenue goal progress">
                <div style={{ width: `${revenueGoalProgress}%` }} />
              </div>
              <div className="dashboard-quick-actions">
                <button type="button" className="btn btn-primary compact-action" onClick={() => setView("reports")}>Open reports</button>
                <button type="button" className="btn btn-secondary compact-action" onClick={() => setView("inventory")}>Open inventory</button>
              </div>
            </div>

            <div className="two-col">
              <div className="card card-pad">
                <div className="row-head">
                  <h3>Active holds</h3>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => { setSearch("pre_sold"); setView("inventory"); }}>Open holds</button>
                </div>
                <div className="table-list">
                  {dashboardActiveHolds.length === 0 && <p className="muted">No active holds in this dashboard period. Add a pre-sold inventory item to see it here.</p>}
                  {dashboardActiveHolds.slice(0, 5).map(i => (
                    <button
                      type="button"
                      className="row-card dashboard-row-button"
                      key={i.id}
                      onClick={() => {
                        setEditingItem(i);
                        setShowInventoryForm(true);
                        setView("inventory");
                      }}
                    >
                      <div className="row-head">
                        <strong>{i.name}</strong>
                        <span className="pill pill-warn">${i.deposit_paid} deposit</span>
                      </div>
                      <p className="muted">{i.brand} • {i.size}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card card-pad">
                <div className="row-head">
                  <h3>Haul watch</h3>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setView("hauls")}>Open hauls</button>
                </div>
                <div className="table-list">
                  {dashboardHauls.length === 0 && <p className="muted">No hauls in this dashboard period. Add a haul to start tracking shipping.</p>}
                  {dashboardHauls.slice(0, 5).map(h => (
                    <button type="button" className="row-card dashboard-row-button" key={h.id} onClick={() => setView("hauls")}>
                      <strong>{h.name}</strong>
                      <p className="muted">{h.agent_name} • {h.status}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "inventory" && (
          <section className="grid">
            <div className="page-actions inventory-top-actions">
              <button
                type="button"
                className="btn btn-primary compact-action"
                onClick={() => {
                  setEditingItem(null);
                  setShowInventoryForm((open) => !open);
                }}
              >
                {showInventoryForm ? "Close Catalog" : "+ Catalog"}
              </button>

              <div className="inventory-allocate-bar">
                <label className="inventory-allocate-cost">
                  Shipping
                  <input
                    type="number"
                    step="0.01"
                    value={shippingCost}
                    onChange={e => setShippingCost(Number(e.target.value))}
                  />
                </label>
                <span className="pill pill-green">{selectedShippingIds.length} selected</span>
                <button className="btn btn-primary compact-action" type="button" onClick={allocateShipping}>
                  Allocate
                </button>
              </div>
            </div>

            <div
              className="card card-pad"
              style={{ display: showInventoryForm || editingItem ? "block" : "none" }}
            >
              <h3>{editingItem ? "Edit item" : "Add inventory item"}</h3>

              <form className="form-grid" onSubmit={saveItem}>
                <label>Name<input name="name" defaultValue={editingItem?.name || ""} required /></label>
                <label>Brand<input name="brand" defaultValue={editingItem?.brand || ""} /></label>

                <label>
                  Category
                  <select className="flipstack-select" name="category" defaultValue={editingItem?.category || ""}>
                    <option value="">Select category</option>
                    <option value="shoes">Shoes</option>
                    <option value="hoodies">Hoodies</option>
                    <option value="shirts">Shirts</option>
                    <option value="pants">Pants</option>
                    <option value="jeans">Jeans</option>
                    <option value="shorts">Shorts</option>
                    <option value="jackets">Jackets</option>
                    <option value="hats">Hats</option>
                    <option value="accessories">Accessories</option>
                    <option value="electronics">Electronics</option>
                    <option value="collectibles">Collectibles</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Colorway
                  <select className="flipstack-select" name="colorway" defaultValue={editingItem?.colorway || ""}>
                    <option value="">Select color</option>
                    <option value="black">Black</option>
                    <option value="white">White</option>
                    <option value="gray">Gray</option>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="brown">Brown</option>
                    <option value="tan">Tan / Beige</option>
                    <option value="pink">Pink</option>
                    <option value="purple">Purple</option>
                    <option value="yellow">Yellow</option>
                    <option value="orange">Orange</option>
                    <option value="multi">Multi-color</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Size
                  <select className="flipstack-select" name="size" defaultValue={editingItem?.size || ""}>
                    <option value="">Select size</option>
                    <option value="one_size">One Size</option>
                    <option value="xs">XS</option>
                    <option value="s">S</option>
                    <option value="m">M</option>
                    <option value="l">L</option>
                    <option value="xl">XL</option>
                    <option value="xxl">XXL</option>
                    <option value="men_7">Men 7</option>
                    <option value="men_8">Men 8</option>
                    <option value="men_9">Men 9</option>
                    <option value="men_10">Men 10</option>
                    <option value="men_11">Men 11</option>
                    <option value="men_12">Men 12</option>
                    <option value="women_6">Women 6</option>
                    <option value="women_7">Women 7</option>
                    <option value="women_8">Women 8</option>
                    <option value="women_9">Women 9</option>
                    <option value="women_10">Women 10</option>
                    <option value="28">28</option>
                    <option value="30">30</option>
                    <option value="32">32</option>
                    <option value="34">34</option>
                    <option value="36">36</option>
                    <option value="38">38</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Source
                  <select className="flipstack-select" name="source" defaultValue={editingItem?.source || "Agent"}>
                    <option value="Agent">Agent</option>
                    <option value="personal_closet">Personal closet</option>
                    <option value="thrift_store">Thrift store</option>
                    <option value="outlet">Outlet</option>
                    <option value="online_deal">Online deal</option>
                    <option value="facebook_marketplace">Facebook Marketplace</option>
                    <option value="offerup">OfferUp</option>
                    <option value="garage_sale">Garage sale</option>
                    <option value="bulk_lot">Bulk lot</option>
                    <option value="friend_family">Friend / family</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>Status
                  <select className="flipstack-select" name="status" defaultValue={editingItem?.status || "available"}>
                    <option value="available">Available</option>
                    <option value="draft">Draft</option>
                    <option value="listed">Listed</option>
                    <option value="reserved">Reserved</option>
                    <option value="pre_sold">Pre-Sold</option>
                    <option value="sold">Sold</option>
                    <option value="shipped">Shipped</option>
                    <option value="returned">Returned</option>
                    <option value="personal_rotation">Personal Rotation</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <label>Buyer
                  <select className="flipstack-select" name="customer_id" defaultValue={editingItem?.customer_id || ""}>
                    <option value="">None</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <label>Product cost<input name="product_cost" type="number" step="0.01" defaultValue={editingItem?.product_cost || 0} /></label>
                <label>Shipping cost<input name="allocated_shipping_cost" type="number" step="0.01" defaultValue={editingItem?.allocated_shipping_cost || 0} /></label>
                <label>Target sale<input name="target_sale_price" type="number" step="0.01" defaultValue={editingItem?.target_sale_price || 0} /></label>
                <label>Deposit<input name="deposit_paid" type="number" step="0.01" defaultValue={editingItem?.deposit_paid || 0} /></label>
                <label className="full">Item photos<input name="images" type="file" accept="image/*" multiple /></label>
                <label className="full">Notes<textarea name="notes" defaultValue={editingItem?.notes || ""} /></label>
                <button disabled={disabled} className="btn btn-primary" type="submit">{editingItem ? "Save changes" : "Add item"}</button>
                {editingItem && <button className="btn btn-secondary" type="button" onClick={() => setEditingItem(null)}>Cancel edit</button>}
              </form>
            </div>


            <div className="catalog-card-grid">
              {filteredItems.map((item: any) => (
                <div
                  className="row-card catalog-crm-card clickable-card"
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditingItem(item as InventoryItem);
                    setShowInventoryForm(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setEditingItem(item as InventoryItem);
                      setShowInventoryForm(true);
                    }
                  }}
                >
                  <label className="inventory-select-corner" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedShippingIds.includes(item.id)}
                      onChange={(e) => setSelectedShippingIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))}
                    />
                    <span>Allocate</span>
                  </label>

                  <div className="row-head catalog-card-head">
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">{item.brand} • {item.size} • {String(item.status || "").replace("_", " ")}</p>
                    </div>
                    <span className="pill pill-green">${(Number(item.product_cost) + Number(item.allocated_shipping_cost)).toFixed(2)} landed</span>
                  </div>

                  {item.image_urls?.length > 0 && (
                    <div className="catalog-image-strip">
                      {item.image_urls.slice(0, 4).map((url: string) => (
                        <img key={url} src={url} alt={item.name} />
                      ))}
                    </div>
                  )}

                  <div className="customer-detail-grid">
                    <div className="customer-detail"><span className="muted">Target</span><strong>${item.target_sale_price || 0}</strong></div>
                    <div className="customer-detail"><span className="muted">Deposit</span><strong>${item.deposit_paid || 0}</strong></div>
                    <div className="customer-detail"><span className="muted">Category</span><strong>{item.category || "—"}</strong></div>
                    <div className="customer-detail"><span className="muted">Source</span><strong>{item.source || "—"}</strong></div>
                  </div>

                  {item.notes && <p className="muted">{item.notes}</p>}

                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-secondary" type="button" onClick={() => { setEditingItem(item as InventoryItem); setShowInventoryForm(true); }}>Edit</button>
                    <button className="btn btn-secondary" type="button" onClick={() => deleteItem(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "customers" && (
          <section className="grid">
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-primary compact-action"
                onClick={() => {
                  if (editingCustomer) setEditingCustomer(null);
                  setShowCustomerForm((open) => !open);
                }}
              >
                {showCustomerForm ? "Close Customer" : "+ Customer"}
              </button>
            </div>

            <div
              className="card card-pad"
              style={{ display: showCustomerForm ? "block" : "none" }}
            >
              <h3>{editingCustomer ? "Edit customer" : "Add customer"}</h3>
              <form className="form-grid" onSubmit={createCustomer}>
                <label>
                  Name
                  <input
                    name="name"
                    defaultValue={editingCustomer?.name || ""}
                    required
                  />
                </label>

                <label>
                  Instagram
                  <input
                    name="instagram_handle"
                    defaultValue={editingCustomer?.instagram_handle || ""}
                  />
                </label>

                <label>
                  Snapchat
                  <input
                    name="snapchat_handle"
                    defaultValue={editingCustomer?.snapchat_handle || ""}
                  />
                </label>

                <label>
                  Depop
                  <input
                    name="depop_handle"
                    defaultValue={editingCustomer?.depop_handle || ""}
                  />
                </label>

                <label className="full">
                  Notes
                  <textarea
                    name="notes"
                    defaultValue={editingCustomer?.notes || ""}
                  />
                </label>

                <button disabled={disabled} className="btn btn-primary" type="submit">
                  {editingCustomer ? "Save changes" : "Save customer"}
                </button>

                {editingCustomer && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingCustomer(null);
                      setShowCustomerForm(false);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </form>
            </div>

            <div className="card card-pad">
              <h3>Buyer directory</h3>
              <div className="customer-card-grid">
                {customers.map((c: any) => {
                  const customerItems = items.filter((item: any) => item.customer_id === c.id);
                  const customerBundles = bundles.filter((bundle: any) => bundle.customer_id === c.id);
                  const totalTarget = customerItems.reduce((sum, item: any) => sum + Number(item.target_sale_price || 0), 0)
                    + customerBundles.reduce((sum, bundle: any) => sum + Number(bundle.bundle_price || 0), 0);
                  const totalDeposits = customerItems.reduce((sum, item: any) => sum + Number(item.deposit_paid || 0), 0)
                    + customerBundles.reduce((sum, bundle: any) => sum + Number(bundle.deposit_paid || 0), 0);

                  const hiddenFields = new Set([
                    "id",
                    "created_at",
                    "updated_at",
                    "user_id",
                    "name",
                  ]);

                  const fields = Object.entries(c).filter(([key, value]) => {
                    return !hiddenFields.has(key) && value !== null && value !== "";
                  });

                  const prettyLabel = (key: string) =>
                    key
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (char) => char.toUpperCase());

                  const prettyValue = (value: any) => {
                    if (value === null || value === undefined || value === "") return "—";
                    if (typeof value === "boolean") return value ? "Yes" : "No";
                    if (Array.isArray(value)) return value.join(", ");
                    if (typeof value === "object") return JSON.stringify(value);
                    return String(value);
                  };

                  return (
                    <div
                      key={c.id}
                      className="row-card customer-crm-card clickable-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCustomer(c as Customer)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedCustomer(c as Customer);
                      }}
                    >
                      <div className="row-head">
                        <div>
                          <strong>{c.name || "Unnamed customer"}</strong>
                          <p className="muted">Tap to open full ledger</p>
                        </div>
                        <span className="pill pill-green">${Number(c.total_spent || totalTarget || 0).toFixed(2)}</span>
                      </div>

                      <div className="customer-detail-grid">
                        <div className="customer-detail"><span className="muted">Items</span><strong>{customerItems.length}</strong></div>
                        <div className="customer-detail"><span className="muted">Bundles</span><strong>{customerBundles.length}</strong></div>
                        <div className="customer-detail"><span className="muted">Deposits</span><strong>${totalDeposits.toFixed(2)}</strong></div>
                        <div className="customer-detail"><span className="muted">Target</span><strong>${totalTarget.toFixed(2)}</strong></div>
                        {fields.map(([key, value]) => (
                          <div key={key} className="customer-detail">
                            <span className="muted">{prettyLabel(key)}</span>
                            <strong>{prettyValue(value)}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingCustomer(c);
                            setShowCustomerForm(true);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => deleteCustomer(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedCustomer && (
              <div className="card card-pad full">
                <div className="row-head"><h3>{selectedCustomer.name} ledger</h3><button type="button" className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>Close</button></div>
                <p className="muted">Total spent: ${selectedCustomer.total_spent || 0}</p>
                <div className="table-list">
                  {items.filter(i => i.customer_id === selectedCustomer.id).map(i => (
                    <div className="row-card" key={i.id}>
                      <strong>{i.name}</strong>
                      <p className="muted">{i.status} • deposit ${i.deposit_paid} • target ${i.target_sale_price}</p>
                    </div>
                  ))}
                  {bundles.filter(b => b.customer_id === selectedCustomer.id).map(b => (
                    <div className="row-card" key={b.id}>
                      <strong>{b.name}</strong>
                      <p className="muted">{b.status} • deposit ${b.deposit_paid} • bundle ${b.bundle_price}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {view === "orders" && (
          <section className="two-col">
            <div className="card card-pad">
              <h3>Create bundle/order</h3>
              <form className="form-grid" onSubmit={createBundle}>
                <label>Name<input name="name" required /></label>
                <label>Buyer<select name="customer_id"><option value="">None</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label>Bundle price<input name="bundle_price" type="number" step="0.01" /></label>
                <label>Deposit paid<input name="deposit_paid" type="number" step="0.01" /></label>
                <label>Status<select name="status"><option value="hold">Hold</option><option value="paid">Paid</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
                <label className="full">Notes<textarea name="notes" /></label>
                <button disabled={disabled} className="btn btn-primary" type="submit">Save bundle</button>
              </form>
            </div>
            <div className="card card-pad">
              <h3>Bundles</h3>
              <div className="table-list">
                {bundles.map(b => <div className="row-card" key={b.id}><strong>{b.name}</strong><p className="muted">{b.status} • ${b.bundle_price} • deposit ${b.deposit_paid}</p></div>)}
              </div>
            </div>
          </section>
        )}

        {view === "hauls" && (
          <section className="two-col">
            <div className="card card-pad">
              <h3>Add haul</h3>
              <form className="form-grid" onSubmit={createHaul}>
                <label>Name<input name="name" required /></label>
                <label>Agent<input name="agent_name" /></label>
                <label>Tracking link<input name="tracking_link" /></label>
                <label>Vendor link<input name="vendor_link" /></label>
                <label>Status<input name="status" defaultValue="warehouse" /></label>
                <label>Shipping cost<input name="total_shipping_cost" type="number" step="0.01" /></label>
                <label>Total weight<input name="total_weight" type="number" step="0.01" /></label>
                <label>Declared value<input name="declared_value" type="number" step="0.01" /></label>
                <label>Carrier<input name="carrier" /></label>
                <label>Country<input name="destination_country" defaultValue="United States" /></label>
                <button disabled={disabled} className="btn btn-primary" type="submit">Save haul</button>
              </form>
            </div>
            <div className="card card-pad">
              <h3>Haul vault</h3>
              <div className="table-list">
                {hauls.map(h => <div className="row-card" key={h.id}><strong>{h.name}</strong><p className="muted">{h.agent_name} • {h.status} • ${h.total_shipping_cost}</p></div>)}
              </div>
            </div>
          </section>
        )}

        {view === "shipping" && (
          <section className="card card-pad">
            <h3>Shippo label creator</h3>
            <p className="muted">This calls your backend route, which calls Shippo using a private server-side token.</p>
            <form className="form-grid" onSubmit={getShippoRates}>
              <label>Recipient name<input name="to_name" required /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Phone<input name="phone" /></label>
              <label>Street<input name="street1" required /></label>
              <label>City<input name="city" required /></label>
              <label>State<input name="state" required maxLength={2} /></label>
              <label>ZIP<input name="zip" required /></label>
              <label>Weight lb<input name="weight" type="number" step="0.1" defaultValue="1" /></label>
              <label>Length in<input name="length" type="number" step="0.1" defaultValue="12" /></label>
              <label>Width in<input name="width" type="number" step="0.1" defaultValue="9" /></label>
              <label>Height in<input name="height" type="number" step="0.1" defaultValue="2" /></label>
              <button className="btn btn-primary" type="submit">Get rates</button>
            </form>
          </section>
        )}

        {view === "reports" && (
          <section className="card card-pad">
            <h3>Reports</h3>
            <p className="muted">Export-ready numbers for bookkeeping.</p>
            <div className="metric-grid">
              <div className="card metric"><span>Revenue</span><strong>${revenue.toFixed(2)}</strong></div>
              <div className="card metric"><span>Capital</span><strong>${capital.toFixed(2)}</strong></div>
              <div className="card metric"><span>Profit</span><strong>${profit.toFixed(2)}</strong></div>
              <div className="card metric"><span>ROI</span><strong>{capital > 0 ? `${((profit / capital) * 100).toFixed(1)}%` : "—"}</strong></div>
            </div>
          </section>
        )}

        {view === "plans" && (
          <section className="grid">
            <div className="metric-grid">
              {Object.entries(PLANS).map(([id, p]) => (
                <div className="card card-pad" key={id}>
                  <p className="eyebrow">{p.name}</p>
                  <h2>{p.price}</h2>
                  <p className="muted">Account Load: {Number.isFinite(p.accountLoadLimit) ? p.accountLoadLimit : "Unlimited"}</p>
                  <ul className="muted">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
                  {id !== "side_hustle" && (
                    <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
                      <button type="button" className="btn btn-primary" onClick={() => createCheckout(id as any, "monthly")}>Monthly</button>
                      <button type="button" className="btn btn-secondary" onClick={() => createCheckout(id as any, "yearly")}>Yearly</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="card card-pad">
              <h3>Founder access</h3>
              <p className="muted">Private founder access is checked server-side. The working email/code are not displayed in the app.</p>
              <form className="form-grid" onSubmit={redeemFounderAccess}>
                <label className="full">Access code<input name="code" type="password" /></label>
                <button className="btn btn-primary" type="submit">Redeem</button>
              </form>
              {profile?.founder_access && <button type="button" className="btn btn-secondary" onClick={seedFounderData}>Seed starter data into my account</button>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
