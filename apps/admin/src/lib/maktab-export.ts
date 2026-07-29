export interface Child {
  name: string;
  dob: string;
  sex: string;
}

export interface Registration {
  id: string;
  status: string;
  monthly_amount_cents: number;
  father_name: string | null;
  mother_name: string | null;
  father_email: string | null;
  mother_email: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  children: Child[];
  payment_customer_id: string | null;
  payment_subscription_id: string | null;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  length_months: number;
  billing_months: number | null;
  prices: { '1': number; '2': number; '3plus': number };
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'UTC' });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (line) => {
      if (/^<[hH]/.test(line) || line === '<hr/>' || line === '</p><p>') return line;
      if (/^\|/.test(line)) return line;
      return line;
    });
}

function parseMarkdownTable(md: string): string {
  const lines = md.trim().split('\n');
  if (lines.length < 2) return '';
  const headerLine = lines[0];
  const separatorLine = lines[1];
  if (!/\|/.test(headerLine) || !/\|/.test(separatorLine)) return '';

  const headers = headerLine.split('|').filter(Boolean).map(h => h.trim());
  const bodyLines = lines.slice(2).filter(l => l.startsWith('|'));

  let html = '<table><thead><tr>';
  for (const h of headers) {
    html += `<th>${escapeHtml(h)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const line of bodyLines) {
    const cells = line.split('|').filter(Boolean).map(c => c.trim());
    html += '<tr>';
    for (const c of cells) {
      html += `<td>${escapeHtml(c)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderMarkdownToHtml(md: string): string {
  const blocks: string[] = [];
  const sections = md.split(/\n\n+/);

  let inTable = false;
  let tableLines: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    const firstLine = lines[0].trim();

    if (firstLine.startsWith('|') && lines.length > 1 && lines[1].trim().startsWith('|')) {
      blocks.push(parseMarkdownTable(trimmed));
      continue;
    }

    if (firstLine.startsWith('#')) {
      const level = firstLine.match(/^#+/)?.[0].length ?? 1;
      const text = firstLine.replace(/^#+\s*/, '');
      blocks.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      continue;
    }

    if (firstLine === '---') {
      blocks.push('<hr/>');
      continue;
    }

    const html = trimmed
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('<br/>');
    blocks.push(`<p>${html}</p>`);
  }

  return blocks.join('\n');
}

function buildTermInfoTable(term: Term): string {
  const monthly = formatCurrency(term.prices['1']);
  const monthly2 = formatCurrency(term.prices['2']);
  const monthly3 = formatCurrency(term.prices['3plus']);
  const billingMonths = term.billing_months ?? term.length_months;

  return `
## Term Information

| Field | Value |
|---|---|
| Term Name | ${term.name} |
| Duration | ${term.length_months} Months${term.billing_months ? ` (billed for ${billingMonths})` : ''} |
| Price (1 child) | ${monthly}/mo |
| Price (2 children) | ${monthly2}/mo |
| Price (3+ children) | ${monthly3}/mo |`;
}

function buildRegistrationMarkdown(reg: Registration, term: Term, index: number): string {
  const fatherName = reg.father_name || 'N/A';
  const motherName = reg.mother_name || 'N/A';
  const fatherEmail = reg.father_email || 'N/A';
  const motherEmail = reg.mother_email || 'N/A';
  const fatherPhone = reg.father_phone || 'N/A';
  const motherPhone = reg.mother_phone || 'N/A';
  const address = `${reg.address_line1}, ${reg.city}, ${reg.state} ${reg.postal_code}`;

  let md = `# Maktab Registration — ${reg.id.slice(0, 8)}

## Parent / Guardian Details

| | Name | Email | Phone |
|---|---|---|---|
| Father | ${fatherName} | ${fatherEmail} | ${fatherPhone} |
| Mother | ${motherName} | ${motherEmail} | ${motherPhone} |

**Address:** ${address}

## Enrolled Children

| # | Name | Sex | Date of Birth |
|---|---|---|---|`;

  for (let i = 0; i < reg.children.length; i++) {
    const c = reg.children[i];
    md += `\n| ${i + 1} | ${c.name} | ${c.sex} | ${c.dob} |`;
  }

  md += `

## Submission Info

| Field | Value |
|---|---|
| Application ID | ${reg.id.slice(0, 8)} |
| Date Submitted | ${formatDateTime(reg.created_at)} |
| Status | ${reg.status} |
| Monthly Amount | ${formatCurrency(reg.monthly_amount_cents)} |
| Customer ID | ${reg.payment_customer_id || 'N/A'} |
| Subscription ID | ${reg.payment_subscription_id || 'N/A'} |`;

  return md;
}

export function buildReportHtml(reg: Registration, term: Term): string {
  const md = buildRegistrationMarkdown(reg, term, 0);
  const body = renderMarkdownToHtml(md);
  return wrapHtml(body);
}

export function buildBulkReportHtml(registrations: Registration[], term: Term): string {
  const pages: string[] = [];

  const termMd = buildTermInfoTable(term);
  pages.push(renderMarkdownToHtml(`# Maktab Registration Report\n\n${termMd}\n\nRegistrations: ${registrations.length}`));

  for (let i = 0; i < registrations.length; i++) {
    const md = buildRegistrationMarkdown(registrations[i], term, i);
    pages.push(`<div style="page-break-before: always;"></div>`);
    pages.push(renderMarkdownToHtml(md));
  }

  return wrapHtml(pages.join('\n'), true);
}

function wrapHtml(body: string, bulk = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Maktab Registration Report</title>
<style>
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 { color: #1e3a8a; font-size: 1.5rem; margin-top: 0; }
  h2 { color: #374151; font-size: 1.15rem; margin-top: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25em; }
  h3 { color: #4b5563; font-size: 1rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.75em 0; }
  th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 0.875rem; }
  th { background-color: #f3f4f6; font-weight: 600; }
  tr:nth-child(even) { background-color: #fafafa; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  strong { color: #1f2937; }
  p { margin: 0.5em 0; }
  @media print {
    body { padding: 0; }
    ${bulk ? 'h1:not(:first-of-type) { page-break-before: always; }' : ''}
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatDobDisplay(dob: string): string {
  return dob;
}

function calcAge(dob: string): { years: number; months: number } {
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  return { years, months };
}

export function exportStudentCSV(registrations: Registration[]): string {
  const rows: string[] = ['Name,Sex,DOB'];
  for (const reg of registrations) {
    for (const child of reg.children) {
      rows.push(`${escapeCsvField(child.name)},${escapeCsvField(child.sex)},${escapeCsvField(formatDobDisplay(child.dob))}`);
    }
  }
  return rows.join('\n');
}

export function exportApplicationsCSV(registrations: Registration[]): string {
  const maxChildren = registrations.reduce((max, r) => Math.max(max, r.children.length), 0);
  const headers = ['ID', 'Date', 'Status', 'Father Name', 'Father Phone', 'Father Email',
    'Mother Name', 'Mother Phone', 'Mother Email', 'Address', 'City', 'State', 'ZIP',
    'Monthly', 'Customer ID', 'Subscription ID'];
  for (let i = 1; i <= maxChildren; i++) {
    headers.push(`Child${i} Name`, `Child${i} Sex`, `Child${i} DOB`);
  }
  const rows: string[] = [headers.join(',')];

  for (const reg of registrations) {
    const base = [
      reg.id.slice(0, 8),
      formatDate(reg.created_at),
      reg.status,
      reg.father_name || '',
      reg.father_phone || '',
      reg.father_email || '',
      reg.mother_name || '',
      reg.mother_phone || '',
      reg.mother_email || '',
      reg.address_line1,
      reg.city,
      reg.state,
      reg.postal_code,
      formatCurrency(reg.monthly_amount_cents),
      reg.payment_customer_id || '',
      reg.payment_subscription_id || '',
    ];
    for (let i = 0; i < maxChildren; i++) {
      const c = reg.children[i];
      base.push(c?.name || '', c?.sex || '', c?.dob || '');
    }
    rows.push(base.map(escapeCsvField).join(','));
  }
  return rows.join('\n');
}

export function downloadHtml(content: string, filename: string): void {
  downloadFile(content, filename, 'text/html');
}

export function downloadCsv(content: string, filename: string): void {
  downloadFile(content, filename, 'text/csv;charset=utf-8');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function calcAgeDisplay(reg: Registration): string[] {
  return reg.children.map(c => {
    const { years, months } = calcAge(c.dob);
    if (years === 0) return `${months}m`;
    return `${years}y ${months}m`;
  });
}