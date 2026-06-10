import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
  const PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
  const USER = Deno.env.get('SMTP_USER') || ''
  const PASS = Deno.env.get('SMTP_PASS') || ''

  const conn = await Deno.connectTls({ hostname: HOST, port: PORT })
  const writer = conn.writable.getWriter()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  let buffer = ''
  async function readLine(): Promise<string> {
    while (!buffer.includes('\n')) {
      const chunk = new Uint8Array(1024)
      const n = await conn.read(chunk)
      if (n === null) break
      buffer += decoder.decode(chunk.subarray(0, n))
    }
    const idx = buffer.indexOf('\n')
    const line = buffer.substring(0, idx).trim()
    buffer = buffer.substring(idx + 1)
    return line
  }

  async function expect(code: string): Promise<void> {
    while (true) {
      const line = await readLine()
      if (line.length > 3 && line[3] === ' ') {
        if (!line.startsWith(code)) {
          throw new Error('SMTP error: ' + line + ' (expected ' + code + ')')
        }
        return
      }
      if (line.length >= 3 && line.startsWith(code) && line[3] !== '-') {
        if (!line.startsWith(code)) {
          throw new Error('SMTP error: ' + line + ' (expected ' + code + ')')
        }
        return
      }
    }
  }

  async function sendRaw(cmd: string): Promise<void> {
    await writer.write(encoder.encode(cmd + '\r\n'))
  }

  // Greeting
  await readLine()

  // EHLO - consume all multiline response
  await sendRaw('EHLO meurzetviajes.com')
  await expect('250')

  // AUTH LOGIN
  await sendRaw('AUTH LOGIN')
  await expect('334')
  await sendRaw(btoa(USER))
  await expect('334')
  await sendRaw(btoa(PASS))
  await expect('235')

  // MAIL FROM / RCPT TO
  await sendRaw('MAIL FROM:<' + USER + '>')
  await expect('250')
  await sendRaw('RCPT TO:<' + to + '>')
  await expect('250')

  // DATA
  await sendRaw('DATA')
  await expect('354')

  const body =
    'From: Meurzet <' + USER + '>\r\n' +
    'To: ' + to + '\r\n' +
    'Subject: ' + subject + '\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/html; charset=UTF-8\r\n' +
    '\r\n' +
    html + '\r\n.'

  await sendRaw(body)
  await expect('250')

  // QUIT
  await sendRaw('QUIT')
  await expect('221')

  writer.releaseLock()
  conn.close()
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Faltan campos: to, subject, html' }), { status: 400 })
    }

    await sendEmail(to, subject, html)
    return new Response(JSON.stringify({ data: { sent: true } }), { status: 200 })
  } catch (err) {
    console.error('Error sending email:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
