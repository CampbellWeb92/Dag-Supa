import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function paypalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const baseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
  if (!clientId || !secret) throw new Error("PayPal server secrets are missing.");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || "Could not authenticate with PayPal.");
  return { token: data.access_token, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { dogId } = await req.json();
    if (!dogId) return json({ error: "A dog ID is required." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dog, error } = await admin.from("dogs").select("id,name,price,status,approval_status,breeder_id").eq("id", dogId).single();
    if (error || !dog) return json({ error: "Dog listing not found." }, 404);
    if (dog.status !== "available" || dog.approval_status !== "approved") return json({ error: "This dog is no longer available." }, 409);
    const { token, baseUrl } = await paypalAccessToken();
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `dag-${dog.id}-${crypto.randomUUID()}` },
      body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ custom_id: dog.id, description: `Dag purchase: ${dog.name}`, amount: { currency_code: "ZAR", value: Number(dog.price).toFixed(2) } }] }),
    });
    const order = await response.json();
    if (!response.ok) return json({ error: order?.message || "PayPal order could not be created." }, 502);
    const { error: paymentError } = await admin.from("payments").insert({ dog_id: dog.id, breeder_id: dog.breeder_id, paypal_order_id: order.id, amount: dog.price, currency: "ZAR", status: "created" });
    if (paymentError) return json({ error: paymentError.message }, 500);
    return json({ orderId: order.id });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500); }
});
