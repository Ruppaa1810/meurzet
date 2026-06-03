import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'PUT') return new Response('Method not allowed', { status: 405 })

  try {
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { userId, email, password } = await req.json()
    const body: Record<string, unknown> = {}
    if (email) body.email = email
    if (password) body.password = password

    if (Object.keys(body).length === 0) return new Response(JSON.stringify({ error: 'No data to update' }), { status: 400 })

    const { error } = await supabase.auth.admin.updateUserById(userId, body)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

    return new Response(JSON.stringify({ data: { userId } }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
