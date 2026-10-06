import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status })

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return json({ error: 'No autorizado' }, 401)
    const { data: caller } = await supabase.from('perfiles').select('rol, activo').eq('id', user.id).single()

    const { email, password, nombre, agencia_nombre, rol: rolPedido, created_by } = await req.json()
    const rol = rolPedido || 'vendedor_minorista'
    const esAdmin = caller?.rol === 'admin_mayorista'
    const esOperador = caller?.rol === 'operador_admin'
    // El operador solo da de alta vendedores, y quedan a su cargo
    if (caller?.activo === false || !(esAdmin || (esOperador && rol === 'vendedor_minorista'))) {
      return json({ error: 'No tenés permiso para crear este usuario' }, 403)
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre, agencia_nombre, rol },
    })
    if (authError) return json({ error: authError.message }, 400)

    const userId = authData.user.id

    const { error: perfilError } = await supabase.from('perfiles').upsert({
      id: userId, nombre, email, agencia_nombre: agencia_nombre || null,
      rol, activo: true,
      created_by: esAdmin ? (created_by || user.id) : user.id,
    })
    if (perfilError) return json({ error: perfilError.message }, 400)

    return json({ data: { id: userId, email, nombre, agencia_nombre } }, 200)
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
