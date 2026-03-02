import { WeeklyReportData, OrgWeeklyStats, Alert } from '@/lib/email-types'

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} → ${e.toLocaleDateString('en-US', opts)}`
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function deltaHTML(current: number, prior: number): string {
  const delta = current - prior
  if (delta > 0) return `<span style="font-size:13px;color:#16a34a;">&#9650; +${delta}</span>`
  if (delta < 0) return `<span style="font-size:13px;color:#dc2626;">&#9660; ${delta}</span>`
  return `<span style="font-size:13px;color:#94a3b8;">—</span>`
}

function statBox(value: string | number, label: string, delta: string): string {
  return `<td style="padding:8px;">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#1e293b;">${value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
      <div style="margin-top:4px;">${delta}</div>
    </div>
  </td>`
}

function alertRow(alert: Alert): string {
  const styles: Record<string, { border: string; bg: string }> = {
    critical: { border: '#ef4444', bg: '#fef2f2' },
    warning: { border: '#f59e0b', bg: '#fffbeb' },
    info: { border: '#3b82f6', bg: '#eff6ff' },
  }
  const s = styles[alert.severity] || styles.info
  return `<div style="border-left:4px solid ${s.border};background:${s.bg};padding:12px 16px;margin-bottom:8px;border-radius:0 6px 6px 0;">
    <span style="font-size:14px;color:#1e293b;"><strong>${alert.orgName}</strong> — ${alert.message}</span>
  </div>`
}

function timeToOpenColor(hours: number): string {
  if (hours < 24) return '#16a34a'
  if (hours <= 48) return '#d97706'
  return '#dc2626'
}

function orgCard(org: OrgWeeklyStats): string {
  let html = ''

  // Org header
  html += `<div style="margin-bottom:16px;">
    <span style="font-size:16px;font-weight:bold;color:#1e293b;">${org.orgName}</span>
    <span style="background:#f1f5f9;color:#64748b;font-size:11px;border-radius:4px;padding:2px 8px;margin-left:8px;">${org.orgType}</span>
  </div>`

  // No activity
  if (!org.hasAnyActivity) {
    html += `<p style="font-size:13px;color:#94a3b8;font-style:italic;">No activity this week</p>`
    return html
  }

  // Stats row
  html += `<p style="font-size:13px;color:#64748b;margin:0 0 12px 0;">
    &#128273; ${org.logins.current} logins &nbsp;&bull;&nbsp;
    &#128994; ${org.activeUsers.current} active &nbsp;&bull;&nbsp;
    &#9989; ${org.funnel.evaluationsSubmitted} evals &nbsp;&bull;&nbsp;
    &#128203; ${org.funnel.plansGenerated} plans &nbsp;&bull;&nbsp;
    &#128064; ${org.funnel.parentOpens} opens
  </p>`

  // Login role breakdown (only if > 1 role present)
  const roles = org.logins.byRole
  const activeRoles = Object.entries(roles).filter(([, v]) => v > 0)
  if (activeRoles.length > 1) {
    const roleParts = activeRoles
      .filter(([k]) => k !== 'unknown')
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}s: ${v}`)
      .join(' &nbsp;&bull;&nbsp; ')
    html += `<p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0;">${roleParts}</p>`
  }

  // Funnel
  if (org.funnel.evaluationsSubmitted > 0 || org.funnel.plansGenerated > 0) {
    html += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      <tr>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:11px;color:#64748b;">Evals Submitted</div>
          <div style="font-size:20px;font-weight:bold;color:#1e293b;">${org.funnel.evaluationsSubmitted}</div>
        </td>
        <td style="text-align:center;color:#94a3b8;font-size:18px;">&rarr;</td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:11px;color:#64748b;">Plans Generated</div>
          <div style="font-size:20px;font-weight:bold;color:#1e293b;">${org.funnel.plansGenerated}</div>
        </td>
        <td style="text-align:center;color:#94a3b8;font-size:18px;">&rarr;</td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:11px;color:#64748b;">Parent Opens</div>
          <div style="font-size:20px;font-weight:bold;color:#1e293b;">${org.funnel.parentOpens}</div>
        </td>
      </tr>
    </table>`

    if (org.funnel.openRate !== null) {
      html += `<p style="font-size:13px;color:#64748b;text-align:right;margin:0 0 8px 0;">${org.funnel.openRate}% open rate</p>`
    }

    if (org.funnel.funnelBroken) {
      html += `<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:10px;margin-bottom:8px;">
        <span style="font-size:13px;color:#92400e;">&#9888; Plans generated but no parent opens yet</span>
      </div>`
    }

    if (org.funnel.medianHoursToOpen !== null) {
      const medColor = timeToOpenColor(org.funnel.medianHoursToOpen)
      let timeStr = `<span style="color:${medColor};">&#9201; Median open: ${org.funnel.medianHoursToOpen}h</span>`
      if (org.funnel.p75HoursToOpen !== null) {
        const p75Color = timeToOpenColor(org.funnel.p75HoursToOpen)
        timeStr += ` &nbsp;&bull;&nbsp; <span style="color:${p75Color};">P75: ${org.funnel.p75HoursToOpen}h</span>`
        if (org.funnel.p75HoursToOpen > 72) {
          timeStr += ` <span style="color:#94a3b8;font-size:11px;">(long tail — some parents very slow)</span>`
        }
      }
      html += `<p style="font-size:13px;margin:0 0 8px 0;">${timeStr}</p>`
    }
  }

  // Top features
  if (org.topFeatures.length > 0) {
    html += `<table width="100%" cellpadding="6" cellspacing="0" style="margin:12px 0;font-size:12px;">
      <tr style="background:#f8fafc;">
        <td style="color:#64748b;font-weight:600;">Feature</td>
        <td style="color:#64748b;font-weight:600;text-align:right;">Events</td>
        <td style="color:#64748b;font-weight:600;text-align:right;">Users</td>
      </tr>`
    org.topFeatures.slice(0, 5).forEach((f, i) => {
      const bg = i === 0 ? 'background:#fffbeb;' : (i % 2 === 1 ? 'background:#f8fafc;' : '')
      html += `<tr style="${bg}">
        <td style="color:#1e293b;">${f.feature}</td>
        <td style="color:#1e293b;text-align:right;">${f.event_count}</td>
        <td style="color:#1e293b;text-align:right;">${f.unique_users}</td>
      </tr>`
    })
    html += `</table>`
  }

  // Errors
  if (org.errors.total > 0) {
    html += `<div style="border:1px solid #fca5a5;background:#fef2f2;border-radius:6px;padding:12px;margin-top:12px;">
      <div style="font-size:13px;font-weight:bold;color:#991b1b;">${org.errors.total} errors this week (${org.errors.rate}%)</div>`
    org.errors.topErrors.slice(0, 3).forEach(e => {
      html += `<div style="font-size:12px;color:#7f1d1d;margin-top:4px;">&bull; ${e.feature} / ${e.error_code} — ${e.count}x</div>`
    })
    html += `</div>`
  }

  return html
}

export function generateWeeklyReportHTML(data: WeeklyReportData): string {
  const p = data.platform
  const supaUrl = process.env.SUPAORGANIZED_URL || '#'

  let html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr><td style="background:#1a1a1a;padding:24px;border-radius:8px 8px 0 0;">
  <div style="font-size:20px;font-weight:bold;color:#f59e0b;">SupaOrganized</div>
  <div style="font-size:14px;color:#ffffff;margin-top:8px;">Weekly Report — ${formatDateRange(data.weekStart, data.weekEnd)}</div>
  <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Generated ${new Date(data.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
</td></tr>

<!-- PLATFORM OVERVIEW -->
<tr><td style="background:#ffffff;padding:24px;">
  <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;margin-bottom:12px;">PLATFORM THIS WEEK</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${statBox(p.totalLogins.current, 'Logins', deltaHTML(p.totalLogins.current, p.totalLogins.prior))}
      ${statBox(p.totalActiveUsers.current, 'Active Users', deltaHTML(p.totalActiveUsers.current, p.totalActiveUsers.prior))}
      ${statBox(p.totalPlansGenerated.current, 'Plans Generated', deltaHTML(p.totalPlansGenerated.current, p.totalPlansGenerated.prior))}
      ${statBox(p.platformOpenRate !== null ? `${p.platformOpenRate}%` : '—', 'Open Rate', p.platformOpenRate !== null ? '' : '<span style="font-size:12px;color:#94a3b8;">No plans</span>')}
    </tr>
  </table>
</td></tr>`

  // ALERTS
  if (data.alerts.length > 0) {
    html += `
<tr><td style="background:#ffffff;padding:0 24px 24px;">
  <div style="font-size:16px;font-weight:bold;color:#1e293b;margin-bottom:12px;">&#128680; Needs Attention</div>
  ${data.alerts.map(a => alertRow(a)).join('')}
</td></tr>`
  }

  // ORG BREAKDOWN
  html += `
<tr><td style="background:#ffffff;padding:0 24px 24px;">
  <div style="font-size:16px;font-weight:bold;color:#1e293b;margin-bottom:16px;">Organization Breakdown</div>`

  data.orgs.forEach((org, i) => {
    if (i > 0) {
      html += `<div style="border-top:1px solid #e2e8f0;margin:20px 0;"></div>`
    }
    html += orgCard(org)
  })

  html += `</td></tr>`

  // FOOTER
  html += `
<tr><td style="background:#f8fafc;padding:20px;text-align:center;border-radius:0 0 8px 8px;">
  <a href="${supaUrl}" style="color:#f59e0b;text-decoration:none;font-weight:bold;font-size:14px;">View full analytics &rarr;</a>
  <div style="font-size:12px;color:#94a3b8;margin-top:8px;">Sent by SupaOrganized &bull; ${formatShortDate(data.generatedAt)}</div>
  <div style="font-size:11px;color:#94a3b8;margin-top:4px;">You're receiving this as the account owner.</div>
</td></tr>

</table>
</td></tr></table>
</body>
</html>`

  return html
}

export function generateWeeklyReportSubject(data: WeeklyReportData): string {
  const p = data.platform
  const weekOf = formatShortDate(data.weekStart)
  let subject = `\u{1F4CA} UniteHQ Week of ${weekOf} — ${p.totalLogins.current} logins, ${p.totalPlansGenerated.current} plans`
  if (p.platformOpenRate !== null) {
    subject += `, ${p.platformOpenRate}% open`
  }
  return subject
}
