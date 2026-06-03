import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Faltan campos: to, subject, html' }), { status: 400 })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('RESEND_API_KEY no configurada, email no enviado', { to, subject })
      return new Response(JSON.stringify({ data: { sent: false, reason: 'RESEND_API_KEY not configured' } }), { status: 200 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Meurzet <notificaciones@meurzet.com>',
        to: [to],
        subject,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: data }), { status: 500 })

    return new Response(JSON.stringify({ data: { sent: true, id: data.id } }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
