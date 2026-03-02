import { Resend } from 'resend'

export async function sendWeeklyReport(html: string, subject: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY not set — logging HTML to console')
    console.log(html)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: `SupaOrganized <reports@${process.env.RESEND_DOMAIN ?? 'resend.dev'}>`,
    to: process.env.FOUNDER_EMAIL!,
    subject,
    html,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}
