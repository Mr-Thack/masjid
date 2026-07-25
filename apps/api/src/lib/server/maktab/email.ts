import type { MaktabConfig } from './types';

interface RegistrationData {
  father?: { name?: string; email?: string; phone?: string };
  mother?: { name?: string; email?: string; phone?: string };
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  children: Array<{ name: string; dob: string; sex: string }>;
}

interface TermInfo {
  name: string;
  length_months: number;
  monthly_cost_cents: number;
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateEmailHtml(
  data: RegistrationData,
  termInfo: TermInfo,
  forwardToEmail: string,
): string {
  const parentFirstNames: string[] = [];
  if (data.father?.name) parentFirstNames.push(data.father.name.split(' ')[0]!);
  if (data.mother?.name) parentFirstNames.push(data.mother.name.split(' ')[0]!);
  const greetingNames = parentFirstNames.length > 0 ? parentFirstNames.join(' and ') : 'Parent/Guardian';

  const totalCostCents = termInfo.monthly_cost_cents * termInfo.length_months;

  const childrenRows = data.children
    .map(
      (child) => `
        <tr>
          <td>${escapeHtml(child.name)}</td>
          <td>${formatDate(child.dob)}</td>
          <td>${escapeHtml(child.sex)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Maktab Registration Confirmation</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;padding:20px;">
  <h1>Assalamu Alaikum Dear ${escapeHtml(greetingNames)},</h1>
  <hr/>
  <h2>Program Details</h2>
  <ul>
    <li><strong>Program:</strong> ${escapeHtml(termInfo.name)}</li>
    <li><strong>Duration:</strong> ${termInfo.length_months} Months</li>
  </ul>
  <h2>Student Information</h2>
  <table style="width:100%;border-collapse:collapse;margin:1em 0;">
    <tr style="background:#f2f2f2;"><th style="border:1px solid #ccc;padding:8px;text-align:left;">Name</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Date of Birth</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Gender</th></tr>
    ${childrenRows}
  </table>
  <h2>Payment Summary</h2>
  <ul>
    <li><strong>Monthly Payment:</strong> $${centsToDollars(termInfo.monthly_cost_cents)}</li>
    <li><strong>Total Program Cost (${termInfo.length_months} Months):</strong> $${centsToDollars(totalCostCents)}</li>
  </ul>
  <h2>Terms &amp; Conditions</h2>
  <ol>
    <li>You enrolled in the <strong>full program (${termInfo.length_months} months)</strong> — not a month-to-month plan.</li>
    <li><strong>No refunds</strong> will be given, even if your child stops attending.</li>
    <li><strong>Monthly payments</strong> will continue as scheduled, even if your child is absent.</li>
    <li>You cannot cancel or withdraw from the program once enrolled.</li>
    <li>Your card will be <strong>automatically charged each month</strong>.</li>
  </ol>
  <p>This email is a confirmation of your enrollment and agreement to these terms.</p>
  <hr/>
  <p><strong>Barakallahu Feekum,</strong><br/><strong>Masjid Maktab Team</strong></p>
  <p><small>This email was automatically generated. Contact ${escapeHtml(forwardToEmail)} for assistance.</small></p>
</body>
</html>`;
}

function generateEmailText(data: RegistrationData, termInfo: TermInfo): string {
  const parentFirstNames: string[] = [];
  if (data.father?.name) parentFirstNames.push(data.father.name.split(' ')[0]!);
  if (data.mother?.name) parentFirstNames.push(data.mother.name.split(' ')[0]!);
  const greetingNames = parentFirstNames.length > 0 ? parentFirstNames.join(' and ') : 'Parent/Guardian';

  const totalCostCents = termInfo.monthly_cost_cents * termInfo.length_months;
  const childEntries = data.children
    .map(
      (child, index) =>
        `${index + 1}. ${child.name}\n- Date of Birth: ${formatDate(child.dob)}\n- Gender: ${child.sex}`,
    )
    .join('\n\n');

  return `Assalamu Alaikum Dear ${greetingNames},

Program Details
- Program: ${termInfo.name}
- Duration: ${termInfo.length_months} Months

Student Information
${childEntries}

Payment Summary
- Monthly Payment: $${centsToDollars(termInfo.monthly_cost_cents)}
- Total Program Cost (${termInfo.length_months} Months): $${centsToDollars(totalCostCents)}

Terms & Conditions
1. You enrolled in the full program (${termInfo.length_months} months) — not a month-to-month plan.
2. No refunds will be given, even if your child stops attending.
3. Monthly payments will continue as scheduled, even if your child is absent.
4. You cannot cancel or withdraw from the program once enrolled.
5. Your card will be automatically charged each month.

Barakallahu Feekum,
Masjid Maktab Team`;
}

export async function sendParentConfirmation(
  registration: RegistrationData,
  termInfo: TermInfo,
  env: MaktabConfig,
): Promise<void> {
  const brevoKey = env.BREVO_API_KEY;
  if (!brevoKey) {
    console.warn('BREVO_API_KEY not configured; skipping Maktab confirmation email');
    return;
  }

  const recipients: { email: string; name?: string }[] = [];
  const cc: { email: string; name?: string }[] = [];
  if (registration.father?.email) {
    recipients.push({ email: registration.father.email, name: registration.father.name });
    if (registration.father.name) cc.push({ email: registration.father.email, name: registration.father.name });
  }
  if (registration.mother?.email) {
    recipients.push({ email: registration.mother.email, name: registration.mother.name });
    if (registration.mother.name) cc.push({ email: registration.mother.email, name: registration.mother.name });
  }

  if (recipients.length === 0) {
    console.warn('No parent email available; skipping Maktab confirmation email');
    return;
  }

  const forwardTo = env.FORWARD_TO_EMAIL || recipients[0]!.email;

  const payload = {
    sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
    to: recipients,
    replyTo: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
    cc,
    bcc: env.LOGGING_EMAIL ? [{ email: env.LOGGING_EMAIL, name: 'Maktab Logging' }] : undefined,
    subject: 'Maktab Registration Confirmation | Masjid',
    htmlContent: generateEmailHtml(registration, termInfo, forwardTo),
    textContent: generateEmailText(registration, termInfo),
    headers: {
      'X-Mailer': `${env.BOT_NAME || 'masjid-api'} (Brevo)`,
      'List-Unsubscribe': `<mailto:${forwardTo}?subject=Unsubscribe>`,
    },
    tags: ['registration', 'maktab', 'confirmation'],
    trackOpens: true,
    trackClicks: true,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoKey,
      'Accept': 'application/json',
      'User-Agent': env.BOT_NAME || 'masjid-api',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Brevo API error: ${response.status} - ${errorData}`);
    throw new Error(`Brevo API error: ${response.status}`);
  }
}
