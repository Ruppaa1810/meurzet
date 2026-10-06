import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status })

serve(async (req) => {
  if (req.method !== 'PUT') return new Response('Method not allowed', { status: 405 })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { userId, email, password } = await req.json()
    const { data: caller } = await supabase.from('perfiles').select('rol, activo').eq('id', user.id).single()
    const { data: target } = await supabase.from('perfiles').select('rol, created_by').eq('id', userId).single()
    const esAdmin = caller?.rol === 'admin_mayorista'
    // El operador solo edita a los vendedores que dio de alta él
    const esSuVendedor = caller?.rol === 'operador_admin' && target?.rol === 'vendedor_minorista' && target?.created_by === user.id
    if (caller?.activo === false || !target || !(esAdmin || esSuVendedor)) {
      return json({ error: 'No tenés permiso para editar este usuario' }, 403)
    }

    const body: Record<string, unknown> = {}
    if (email) body.email = email
    if (password) body.password = password

    if (Object.keys(body).length === 0) return json({ error: 'No data to update' }, 400)

    const { error } = await supabase.auth.admin.updateUserById(userId, body)
    if (error) return json({ error: error.message }, 400)

    if (email) {
      await supabase.from('perfiles').update({ email }).eq('id', userId)
    }

    return json({ data: { userId } }, 200)
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
