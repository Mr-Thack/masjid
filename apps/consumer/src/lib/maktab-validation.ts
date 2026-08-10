/**
 * Client-side validation for the Maktab enrollment form.
 *
 * Pure functions so they can be unit-tested without rendering the page.
 * `validateEnrollment` returns a structured error map (one entry per field /
 * per child) so the form can highlight exactly which inputs need attention;
 * `summarizeErrors` flattens the map into human-readable lines for the error
 * summary panel.
 *
 * The rules mirror the server-side `SquareEnrollmentSchema`
 * (packages/schemas/src/maktab.ts) so most mistakes are caught — and
 * explained — before the form is ever submitted.
 */

export interface ParentInput {
  name: string;
  phone: string;
  email: string;
}

export interface EnrollmentChild {
  name: string;
  dob: string;
  sex: string;
}

export interface EnrollmentForm {
  father: ParentInput;
  mother: ParentInput;
  address_line1: string;
  city: string;
  postal_code: string;
  card_holder_name: string;
  children: EnrollmentChild[];
}

export interface ParentErrors {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ChildErrors {
  name?: string;
  dob?: string;
  sex?: string;
}

export interface EnrollmentErrors {
  /** Neither parent has complete information (name + phone + email). */
  parents?: string;
  /** Per-parent field errors when a parent is only partially filled in. */
  parentErrors: { father: ParentErrors | null; mother: ParentErrors | null };
  /** No children added at all. */
  children?: string;
  /** Per-child field errors (same order as form.children). */
  childErrors: (ChildErrors | null)[];
  address_line1?: string;
  city?: string;
  postal_code?: string;
  card_holder_name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Light client-side check — the server (libphonenumber) stays authoritative.
// Matches the form hint: international format with country code.
const PHONE_RE = /^\+[0-9\s\-().]{6,}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

function validateParent(input: ParentInput): ParentErrors | null {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!name && !phone && !email) return null;

  const errors: ParentErrors = {};
  if (!name) {
    errors.name = 'Enter the name.';
  }
  if (!phone) {
    errors.phone = 'Enter the phone number, including country code (e.g. +1 123 456 7890).';
  } else if (!PHONE_RE.test(phone)) {
    errors.phone =
      'Enter a valid phone number starting with + and the country code (e.g. +1 123 456 7890).';
  }
  if (!email) {
    errors.email = 'Enter the email address.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

function parentComplete(input: ParentInput): boolean {
  return !!(input.name.trim() && input.phone.trim() && input.email.trim());
}

export function validateEnrollment(form: EnrollmentForm): EnrollmentErrors {
  const father = validateParent(form.father);
  const mother = validateParent(form.mother);
  const errors: EnrollmentErrors = {
    parentErrors: { father, mother },
    childErrors: [],
  };

  if (!parentComplete(form.father) && !parentComplete(form.mother)) {
    errors.parents =
      "At least one parent's complete information (name, phone, and email) is required.";
  }

  if (!form.address_line1.trim()) {
    errors.address_line1 = 'Enter the street address.';
  } else if (form.address_line1.trim().length < 5) {
    errors.address_line1 = 'Enter a complete street address.';
  }
  if (!form.city.trim()) {
    errors.city = 'Enter the city.';
  } else if (form.city.trim().length < 2) {
    errors.city = 'Enter a valid city.';
  }
  if (!form.postal_code.trim()) {
    errors.postal_code = 'Enter the ZIP code.';
  } else if (!ZIP_RE.test(form.postal_code.trim())) {
    errors.postal_code = 'Enter a valid ZIP code (e.g. 30303).';
  }

  if (form.children.length === 0) {
    errors.children = 'Add at least one child.';
  }
  for (const child of form.children) {
    const childErr: ChildErrors = {};
    if (!child.name.trim()) {
      childErr.name = "Enter the child's full name.";
    } else if (child.name.trim().length < 2) {
      childErr.name = 'Name must be at least 2 characters.';
    }
    if (!child.dob) childErr.dob = 'Select the date of birth.';
    if (!child.sex) childErr.sex = 'Select the gender.';
    errors.childErrors.push(Object.keys(childErr).length > 0 ? childErr : null);
  }

  if (!form.card_holder_name.trim()) {
    errors.card_holder_name = 'Enter the card holder name.';
  }

  return errors;
}

export function hasErrors(errors: EnrollmentErrors): boolean {
  return (
    !!errors.parents ||
    !!errors.parentErrors.father ||
    !!errors.parentErrors.mother ||
    !!errors.children ||
    errors.childErrors.some((c) => c !== null) ||
    !!errors.address_line1 ||
    !!errors.city ||
    !!errors.postal_code ||
    !!errors.card_holder_name
  );
}

/**
 * Flatten the structured errors into one line per problem, in the same order
 * the sections appear on the form (parents → address → children → payment).
 */
export function summarizeErrors(errors: EnrollmentErrors): string[] {
  const lines: string[] = [];
  if (errors.parents) lines.push(`Parent / Guardian: ${errors.parents}`);
  for (const [label, parentErr] of [
    ['Father', errors.parentErrors.father],
    ['Mother', errors.parentErrors.mother],
  ] as const) {
    if (!parentErr) continue;
    for (const message of [parentErr.name, parentErr.phone, parentErr.email]) {
      if (message) lines.push(`${label}: ${message}`);
    }
  }
  if (errors.address_line1) lines.push(`Address: ${errors.address_line1}`);
  if (errors.city) lines.push(`Address: ${errors.city}`);
  if (errors.postal_code) lines.push(`Address: ${errors.postal_code}`);
  if (errors.children) lines.push(`Children: ${errors.children}`);
  errors.childErrors.forEach((childErr, i) => {
    if (!childErr) return;
    for (const message of [childErr.name, childErr.dob, childErr.sex]) {
      if (message) lines.push(`Child ${i + 1}: ${message}`);
    }
  });
  if (errors.card_holder_name) lines.push(`Payment: ${errors.card_holder_name}`);
  return lines;
}
