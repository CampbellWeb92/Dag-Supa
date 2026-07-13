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
    const { orderId, dogId } = await req.json();
    if (!orderId || !dogId) return json({ error: "Order ID and dog ID are required." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: payment } = await admin.from("payments").select("*").eq("paypal_order_id", orderId).eq("dog_id", dogId).single();
    if (!payment) return json({ error: "Payment record not found." }, 404);
    if (payment.status === "completed") return json({ success: true });
    const { token, baseUrl } = await paypalAccessToken();
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `capture-${orderId}` } });
    const capture = await response.json();
    const captureInfo = capture?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!response.ok || captureInfo?.status !== "COMPLETED") return json({ error: capture?.message || "PayPal did not confirm a completed payment." }, 502);
    const paidAmount = Number(captureInfo.amount?.value);
    if (captureInfo.amount?.currency_code !== payment.currency || paidAmount !== Number(payment.amount)) return json({ error: "PayPal amount or currency did not match the listing." }, 409);
    const { data: updatedDog, error: dogError } = await admin.from("dogs").update({ status: "unavailable", paypal_order_id: orderId, paypal_capture_id: captureInfo.id, payment_received_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", dogId).eq("status", "available").select("id").maybeSingle();
    if (dogError || !updatedDog) return json({ error: "The payment completed, but the listing was already unavailable. Contact Dag support immediately." }, 409);
    await admin.from("payments").update({ status: "completed", paypal_capture_id: captureInfo.id, buyer_email: capture?.payer?.email_address || null, completed_at: new Date().toISOString() }).eq("id", payment.id);
    return json({ success: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500); }
});
