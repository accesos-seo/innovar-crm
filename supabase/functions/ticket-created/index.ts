import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Cocinas INNOVAR <soporte@cocinasintegralespereira.co>";
const APP_URL = "https://crm-innovar-app-2026.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: CORS });

  try {
    const { ticket_id, ticket_ref } = (await req.json()) as {
      ticket_id: number;
      ticket_ref: string;
    };

    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Load ticket + creator
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select(
        "*, creator:profiles!created_by(full_name, email)"
      )
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) {
      console.error("[ticket-created] ticket not found:", tErr);
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const creatorEmail = ticket.creator?.email;
    const creatorName = ticket.creator?.full_name ?? "Usuario";

    // 1. Email to creator
    if (creatorEmail) {
      const creatorHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
          <div style="background:#0f172a;padding:32px;text-align:center">
            <h1 style="color:#44ddc1;font-size:24px;margin:0;letter-spacing:2px">INNOVAR</h1>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Sistemas de Cocinas</p>
          </div>
          <div style="padding:32px;background:#ffffff">
            <p style="font-size:14px;color:#475569">Hola ${creatorName},</p>
            <p style="font-size:14px;color:#475569">Tu ticket ha sido recibido y está siendo revisado por nuestro equipo.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Detalle del ticket</p>
              <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#0f172a">${ticket.ticket_ref ?? ticket_ref}</p>
              <p style="margin:0 0 12px;font-size:14px;color:#334155">${ticket.subject}</p>
              <p style="margin:0;font-size:12px;color:#64748b">Categoría: ${ticket.category} &nbsp;·&nbsp; Prioridad: ${ticket.priority}</p>
            </div>
            <p style="font-size:14px;color:#475569">Te notificaremos cuando un miembro del equipo responda.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${APP_URL}/soporte/${ticket_id}" style="background:#44ddc1;color:#0f172a;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px">
                Ver Ticket
              </a>
            </div>
          </div>
          <div style="padding:16px 32px;background:#f8fafc;text-align:center">
            <p style="font-size:11px;color:#94a3b8;margin:0">Cocinas Integrales Pereira &mdash; soporte@cocinasintegralespereira.co</p>
          </div>
        </div>`;

      await sendEmail(
        creatorEmail,
        `✅ Ticket ${ticket.ticket_ref ?? ticket_ref} recibido`,
        creatorHtml
      ).catch((e) => console.warn("[ticket-created] creator email failed:", e));
    }

    // 2. Notify admins
    const { data: admins } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("role", ["admin", "super_admin"])
      .eq("is_active", true);

    if (admins && admins.length > 0) {
      const adminHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
          <div style="background:#0f172a;padding:24px;text-align:center">
            <h1 style="color:#44ddc1;font-size:20px;margin:0;letter-spacing:2px">INNOVAR — Nuevo Ticket</h1>
          </div>
          <div style="padding:24px;background:#ffffff">
            <p style="font-size:14px;color:#475569">Se recibió un nuevo ticket de soporte.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0 0 4px;font-weight:700;font-size:14px">${ticket.ticket_ref ?? ticket_ref}: ${ticket.subject}</p>
              <p style="margin:0;font-size:12px;color:#64748b">De: ${creatorName} &nbsp;·&nbsp; ${ticket.category} &nbsp;·&nbsp; ${ticket.priority}</p>
              ${ticket.description ? `<p style="margin:8px 0 0;font-size:13px;color:#475569">${ticket.description}</p>` : ""}
            </div>
            <div style="text-align:center;margin:20px 0">
              <a href="${APP_URL}/soporte/${ticket_id}" style="background:#44ddc1;color:#0f172a;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px">
                Abrir Ticket
              </a>
            </div>
          </div>
        </div>`;

      for (const admin of admins) {
        if (admin.email) {
          await sendEmail(
            admin.email,
            `🎫 Nuevo ticket ${ticket.ticket_ref ?? ticket_ref}: ${ticket.subject}`,
            adminHtml
          ).catch((e) =>
            console.warn("[ticket-created] admin email failed:", e)
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    console.error("[ticket-created] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
