/**
 * Daily digest email.
 *
 * Design rule: this must stay SIGNAL. If nothing happened, the caller skips the
 * send entirely rather than mailing a wall of zeroes — an inbox that reliably
 * contains something worth reading is the only kind that keeps getting opened.
 */

export interface DigestPerson {
  name: string
  email: string | null
  kind?: string
  detail?: string
}

export interface DigestCoach {
  name: string
  stage: string
  nextAction: string
  daysStalled: number | null
}

export interface DigestInput {
  generatedAt: Date
  newSignups: DigestPerson[]
  newCoaches: DigestCoach[]
  activeUsers7d: number
  activeUsers30d: number
  neverActivatedCount: number
  slipping: DigestPerson[]
  stalledCoaches: DigestCoach[]
  errorCount: number
  mrrCents: number | null
  warnings: string[]
}

/** True when there is nothing worth mailing about. */
export function isDigestEmpty(input: DigestInput): boolean {
  return (
    input.newSignups.length === 0 &&
    input.newCoaches.length === 0 &&
    input.slipping.length === 0 &&
    input.errorCount === 0 &&
    input.warnings.length === 0
  )
}

export function digestSubject(input: DigestInput): string {
  const bits: string[] = []
  if (input.newCoaches.length > 0) {
    bits.push(`${input.newCoaches.length} new coach${input.newCoaches.length > 1 ? 'es' : ''}`)
  }
  if (input.newSignups.length > 0) bits.push(`${input.newSignups.length} new signup${input.newSignups.length > 1 ? 's' : ''}`)
  if (input.errorCount > 0) bits.push(`${input.errorCount} errors`)
  const summary = bits.length > 0 ? bits.join(' · ') : 'Quiet day'
  const date = input.generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `UniteHQ · ${summary} · ${date}`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function section(title: string, body: string): string {
  return `
    <tr><td style="padding:20px 24px 8px 24px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">${esc(title)}</p>
    </td></tr>
    <tr><td style="padding:0 24px 12px 24px;">${body}</td></tr>`
}

function personList(people: DigestPerson[]): string {
  if (people.length === 0) return '<p style="margin:0;color:#64748b;font-size:14px;">None.</p>'
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${people
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #1f2937;">
          <span style="color:#f1f5f9;font-size:14px;font-weight:600;">${esc(p.name)}</span>
          ${p.kind ? `<span style="color:#64748b;font-size:12px;"> · ${esc(p.kind)}</span>` : ''}
          ${p.email ? `<br><span style="color:#64748b;font-size:12px;">${esc(p.email)}</span>` : ''}
          ${p.detail ? `<br><span style="color:#94a3b8;font-size:12px;">${esc(p.detail)}</span>` : ''}
        </td>
      </tr>`
    )
    .join('')}</table>`
}

function coachList(coaches: DigestCoach[]): string {
  if (coaches.length === 0) return '<p style="margin:0;color:#64748b;font-size:14px;">None.</p>'
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${coaches
    .map(
      (c) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #1f2937;">
          <span style="color:#f1f5f9;font-size:14px;font-weight:600;">${esc(c.name)}</span>
          <span style="color:#f59e0b;font-size:12px;"> · ${esc(c.stage)}</span>
          ${c.daysStalled !== null && c.daysStalled > 30 ? `<span style="color:#ef4444;font-size:12px;"> · ${c.daysStalled}d stalled</span>` : ''}
          <br><span style="color:#94a3b8;font-size:12px;">${esc(c.nextAction)}</span>
        </td>
      </tr>`
    )
    .join('')}</table>`
}

export function renderDailyDigest(input: DigestInput): string {
  const dateLabel = input.generatedAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const stats = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:8px 0;"><span style="color:#f1f5f9;font-size:26px;font-weight:700;">${input.activeUsers7d}</span><br><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Active 7d</span></td>
        <td style="padding:8px 0;"><span style="color:#f1f5f9;font-size:26px;font-weight:700;">${input.activeUsers30d}</span><br><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Active 30d</span></td>
        <td style="padding:8px 0;"><span style="color:${input.neverActivatedCount > 0 ? '#f59e0b' : '#f1f5f9'};font-size:26px;font-weight:700;">${input.neverActivatedCount}</span><br><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Never signed in</span></td>
        ${
          input.mrrCents !== null
            ? `<td style="padding:8px 0;"><span style="color:#22c55e;font-size:26px;font-weight:700;">$${Math.round(input.mrrCents / 100).toLocaleString()}</span><br><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">MRR</span></td>`
            : ''
        }
      </tr>
    </table>`

  const body = [
    section('At a glance', stats),
    input.newCoaches.length > 0 ? section('🎉 New coaches', coachList(input.newCoaches)) : '',
    input.newSignups.length > 0 ? section('New signups', personList(input.newSignups)) : '',
    input.stalledCoaches.length > 0
      ? section('Coaches stuck in the funnel', coachList(input.stalledCoaches))
      : '',
    input.slipping.length > 0
      ? section('Slipping away — active recently, quiet now', personList(input.slipping))
      : '',
    input.errorCount > 0
      ? section(
          'Errors',
          `<p style="margin:0;color:#ef4444;font-size:14px;">${input.errorCount} error events in the last 24 hours.</p>`
        )
      : '',
    input.warnings.length > 0
      ? section(
          'Data quality',
          `<ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:12px;">${input.warnings
            .map((w) => `<li>${esc(w)}</li>`)
            .join('')}</ul>`
        )
      : '',
  ].join('')

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 24px 0 24px;">
          <p style="margin:0;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">SupaOrganized</p>
          <h1 style="margin:6px 0 0 0;color:#f8fafc;font-size:22px;font-weight:700;">Daily digest</h1>
          <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">${esc(dateLabel)}</p>
        </td></tr>
        ${body}
        <tr><td style="padding:16px 24px 24px 24px;border-top:1px solid #1f2937;">
          <p style="margin:0;color:#475569;font-size:11px;">
            League orgs are excluded — they are the retired product.
            Percentages are omitted where the sample is too small to be meaningful.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
