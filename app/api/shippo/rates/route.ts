import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Missing SHIPPO_API_TOKEN" }, { status: 500 });

  const body = await req.json();

  const address_from = body.address_from || {
    name: "FlipStack Seller",
    street1: "CHANGE_ME",
    city: "CHANGE_ME",
    state: "OH",
    zip: "00000",
    country: "US"
  };

  const shippoRes = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: {
      "Authorization": `ShippoToken ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      address_from,
      address_to: body.address_to,
      parcels: [body.parcel],
      async: false
    })
  });

  const data = await shippoRes.json();
  if (!shippoRes.ok) return NextResponse.json({ error: "Shippo shipment failed", details: data }, { status: 400 });

  return NextResponse.json({
    shipment_id: data.object_id,
    rates: data.rates || []
  });
}
