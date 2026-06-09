// n8n-proxy — puente server-side para operaciones de workflow (activate/deactivate/status)
// El N8N_TOKEN nunca sale del servidor. El frontend solo llama a esta función con auth Supabase.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const N8N_BASE = 'https://estancias-atlas-n8n.heh8a3.easypanel.host'
const N8N_TOKEN = Deno.env.get('N8N_TOKEN') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const workflowId = url.searchParams.get('workflow_id')
  if (!workflowId) return json({ error: 'workflow_id required' }, 400)

  try {
    if (req.method === 'GET') {
      const res = await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}`, {
        headers: { 'X-N8N-API-KEY': N8N_TOKEN },
      })
      const data = await res.json()
      return json({ active: data.active ?? false, id: data.id, name: data.name })
    }

    if (req.method === 'POST') {
      const { action } = await req.json()
      if (action !== 'activate' && action !== 'deactivate') {
        return json({ error: 'action must be activate | deactivate' }, 400)
      }
      const res = await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}/${action}`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': N8N_TOKEN },
      })
      const data = await res.json()
      return json({ active: data.active ?? false, id: data.id })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
