"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Customer, InventoryItem, Haul, Bundle, Profile } from "@/lib/types";
import { PLANS, canUseFeature, PlanId } from "@/lib/plans";

type View = "dashboard" | "inventory" | "customers" | "orders" | "hauls" | "shipping" | "reports" | "plans";

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

  const filteredItems = items.filter(item => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [item.name, item.brand, item.category, item.colorway, item.size, item.status].some(v => (v || "").toLowerCase().includes(q));
  });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function createCustomer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return setMessage("Account disabled. Rectify your limit first.");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      instagram_handle: String(fd.get("instagram") || ""),
      snapchat_handle: String(fd.get("snapchat") || ""),
      depop_handle: String(fd.get("depop") || ""),
      notes: String(fd.get("notes") || "")
    };
    const { error } = await supabase.from("customers").insert(payload);
    if (error) setMessage(error.message);
    else {
      setMessage("Customer saved.");
      e.currentTarget.reset();
      refresh();
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

  async function createCheckout(planTarget: "active_flipper" | "apex", interval: "monthly" | "yearly") {
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ plan: planTarget, interval })
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not start checkout.");
    window.location.href = json.url;
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
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        <div className="card card-pad" style={{marginTop: 18}}>
          <p className="eyebrow">Current plan</p>
          <h3>{PLANS[plan]?.name}</h3>
          <p className="muted">{accountLoad} account load / {Number.isFinite(PLANS[plan].accountLoadLimit) ? PLANS[plan].accountLoadLimit : "Unlimited"}</p>
          <button className="btn btn-secondary" onClick={signOut}>Logout</button>
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
            <div className="card card-pad">
              <img className="logo-lockup" src="/assets/flipstack-app-lockup-transparent.png" alt="FlipStack" />
              <h2>Welcome to your live FlipStack workspace.</h2>
              <p className="muted">This version is database-backed with Supabase Auth, RLS, plans, labels, hauls, and account enforcement.</p>
            </div>
            <div className="metric-grid">
              <div className="card metric"><span>Projected Revenue</span><strong>${revenue.toFixed(2)}</strong></div>
              <div className="card metric"><span>Capital Out</span><strong>${capital.toFixed(2)}</strong></div>
              <div className="card metric"><span>Projected Profit</span><strong className="good">${profit.toFixed(2)}</strong></div>
              <div className="card metric"><span>Deposits</span><strong>${deposits.toFixed(2)}</strong></div>
            </div>
            <div className="two-col">
              <div className="card card-pad">
                <h3>Active holds</h3>
                <div className="table-list">
                  {items.filter(i => i.status === "pre_sold").map(i => (
                    <div className="row-card" key={i.id}>
                      <div className="row-head"><strong>{i.name}</strong><span className="pill pill-warn">${i.deposit_paid} deposit</span></div>
                      <p className="muted">{i.brand} • {i.size}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card card-pad">
                <h3>Haul watch</h3>
                <div className="table-list">
                  {hauls.slice(0,5).map(h => <div className="row-card" key={h.id}><strong>{h.name}</strong><p className="muted">{h.agent_name} • {h.status}</p></div>)}
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "inventory" && (
          <section className="grid">
            <div className="card card-pad">
              <h3>{editingItem ? "Edit item" : "Add inventory item"}</h3>
              <form className="form-grid" onSubmit={saveItem}>
                <label>Name<input name="name" defaultValue={editingItem?.name || ""} required /></label>
                <label>Brand<input name="brand" defaultValue={editingItem?.brand || ""} /></label>
                <label>Category<input name="category" defaultValue={editingItem?.category || ""} /></label>
                <label>Colorway<input name="colorway" defaultValue={editingItem?.colorway || ""} /></label>
                <label>Size<input name="size" defaultValue={editingItem?.size || ""} /></label>
                <label>Source<input name="source" defaultValue={editingItem?.source || "Agent"} /></label>
                <label>Status
                  <select name="status" defaultValue={editingItem?.status || "available"}>
                    <option value="available">Available</option>
                    <option value="pre_sold">Pre-Sold</option>
                    <option value="sold">Sold</option>
                    <option value="personal_rotation">Personal Rotation</option>
                  </select>
                </label>
                <label>Buyer
                  <select name="customer_id" defaultValue={editingItem?.customer_id || ""}>
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

            <div className="card card-pad">
              <h3>Selective landed cost</h3>
              <div className="form-grid">
                <label>Total shipping cost<input type="number" step="0.01" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} /></label>
                <div><p className="muted">{selectedShippingIds.length} selected</p><button className="btn btn-primary" onClick={allocateShipping}>Allocate shipping</button></div>
              </div>
            </div>

            <div className="table-list">
              {filteredItems.map(item => (
                <div className="card card-pad" key={item.id}>
                  <div className="row-head">
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">{item.brand} • {item.size} • {item.status.replace("_", " ")}</p>
                    </div>
                    <span className="pill pill-green">${(Number(item.product_cost) + Number(item.allocated_shipping_cost)).toFixed(2)} landed</span>
                  </div>
                  <p>Target: ${item.target_sale_price} • Deposit: ${item.deposit_paid}</p>
                  {item.image_urls?.length > 0 && (
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                      {item.image_urls.slice(0, 4).map((url) => (
                        <img key={url} src={url} alt={item.name} style={{width: 74, height: 74, objectFit: "cover", borderRadius: 14, border: "1px solid var(--line)"}} />
                      ))}
                    </div>
                  )}
                  <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
                    <label style={{display: "flex", alignItems: "center", gap: 8, width: "auto"}}>
                      <input style={{width: "auto"}} type="checkbox" checked={selectedShippingIds.includes(item.id)} onChange={(e) => setSelectedShippingIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} />
                      Allocate shipping
                    </label>
                    <button className="btn btn-secondary" onClick={() => setEditingItem(item)}>Edit</button>
                    <button className="btn btn-secondary" onClick={() => deleteItem(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "customers" && (
          <section className="two-col">
            <div className="card card-pad">
              <h3>Add customer</h3>
              <form className="form-grid" onSubmit={createCustomer}>
                <label>Name<input name="name" required /></label>
                <label>Instagram<input name="instagram" /></label>
                <label>Snapchat<input name="snapchat" /></label>
                <label>Depop<input name="depop" /></label>
                <label className="full">Notes<textarea name="notes" /></label>
                <button disabled={disabled} className="btn btn-primary" type="submit">Save customer</button>
              </form>
            </div>
            <div className="card card-pad">
              <h3>Buyer directory</h3>
              <div className="table-list">
                {customers.map(c => (
                  <button className="row-card" style={{color: "inherit", textAlign: "left", cursor: "pointer"}} key={c.id} onClick={() => setSelectedCustomer(c)}>
                    <div className="row-head"><strong>{c.name}</strong><span className="pill">{c.vouch_count} vouches</span></div>
                    <p className="muted">IG: {c.instagram_handle || "—"} • Snap: {c.snapchat_handle || "—"} • Depop: {c.depop_handle || "—"}</p>
                  </button>
                ))}
              </div>
            </div>
            {selectedCustomer && (
              <div className="card card-pad full">
                <div className="row-head"><h3>{selectedCustomer.name} ledger</h3><button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>Close</button></div>
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
                      <button className="btn btn-primary" onClick={() => createCheckout(id as any, "monthly")}>Monthly</button>
                      <button className="btn btn-secondary" onClick={() => createCheckout(id as any, "yearly")}>Yearly</button>
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
              {profile?.founder_access && <button className="btn btn-secondary" onClick={seedFounderData}>Seed starter data into my account</button>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
