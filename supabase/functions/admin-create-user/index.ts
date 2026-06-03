import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { email, password, nombre, agencia_nombre, rol, created_by } = await req.json()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre, agencia_nombre, rol },
    })
    if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400 })

    const userId = authData.user.id

    const { error: perfilError } = await supabase.from('perfiles').upsert({
      id: userId, nombre, agencia_nombre: agencia_nombre || null,
      rol: rol || 'vendedor_minorista', activo: true,
      ...(created_by ? { created_by } : {}),
    })
    if (perfilError) return new Response(JSON.stringify({ error: perfilError.message }), { status: 400 })

    return new Response(JSON.stringify({ data: { id: userId, email, nombre, agencia_nombre } }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
