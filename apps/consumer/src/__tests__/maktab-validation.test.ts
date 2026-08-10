import { describe, it, expect } from 'vitest';
import {
  validateEnrollment,
  hasErrors,
  summarizeErrors,
  type EnrollmentForm,
} from '../lib/maktab-validation';

function validForm(): EnrollmentForm {
  return {
    father: { name: 'Ahmad Ali', phone: '+14155550123', email: 'ahmad@example.com' },
    mother: { name: '', phone: '', email: '' },
    address_line1: '123 Main St',
    city: 'Chicago',
    postal_code: '60601',
    card_holder_name: 'Ahmad Ali',
    children: [{ name: 'Yusuf', dob: '2015-05-05', sex: 'male' }],
  };
}

describe('validateEnrollment', () => {
  it('returns no errors for a complete form', () => {
    const errors = validateEnrollment(validForm());
    expect(hasErrors(errors)).toBe(false);
    expect(summarizeErrors(errors)).toEqual([]);
  });

  it('flags every section of an empty form', () => {
    const errors = validateEnrollment({
      father: { name: '', phone: '', email: '' },
      mother: { name: '', phone: '', email: '' },
      address_line1: '',
      city: '',
      postal_code: '',
      card_holder_name: '',
      children: [{ name: '', dob: '', sex: '' }],
    });
    expect(hasErrors(errors)).toBe(true);
    expect(errors.parents).toBeTruthy();
    expect(errors.address_line1).toBeTruthy();
    expect(errors.city).toBeTruthy();
    expect(errors.postal_code).toBeTruthy();
    expect(errors.childErrors[0]).toEqual({
      name: expect.any(String),
      dob: expect.any(String),
      sex: expect.any(String),
    });
    expect(errors.card_holder_name).toBeTruthy();
  });

  it('requires phone and email when a parent name is given (matches server rules)', () => {
    const form = validForm();
    form.father = { name: 'Ahmad Ali', phone: '', email: '' };
    const errors = validateEnrollment(form);
    expect(hasErrors(errors)).toBe(true);
    expect(errors.parentErrors.father).toEqual({
      phone: expect.any(String),
      email: expect.any(String),
    });
    // A partially-filled parent is not "complete", so the section error fires too.
    expect(errors.parents).toBeTruthy();
  });

  it('accepts a complete mother with no father', () => {
    const form = validForm();
    form.father = { name: '', phone: '', email: '' };
    form.mother = { name: 'Fatima Ali', phone: '+14155550124', email: 'fatima@example.com' };
    const errors = validateEnrollment(form);
    expect(hasErrors(errors)).toBe(false);
  });

  it('rejects invalid email and phone formats', () => {
    const form = validForm();
    form.father = { name: 'Ahmad', phone: '555-0123', email: 'not-an-email' };
    const errors = validateEnrollment(form);
    expect(errors.parentErrors.father?.phone).toContain('country code');
    expect(errors.parentErrors.father?.email).toContain('valid email');
  });

  it('validates ZIP code format', () => {
    const form = validForm();
    form.postal_code = 'ABCDE';
    expect(validateEnrollment(form).postal_code).toContain('valid ZIP');
    form.postal_code = '60601-1234';
    expect(hasErrors(validateEnrollment(form))).toBe(false);
  });

  it('reports errors per child with the child index in the summary', () => {
    const form = validForm();
    form.children = [
      { name: 'Yusuf', dob: '2015-05-05', sex: 'male' },
      { name: '', dob: '', sex: '' },
    ];
    const errors = validateEnrollment(form);
    expect(errors.childErrors[0]).toBeNull();
    expect(errors.childErrors[1]).not.toBeNull();
    const lines = summarizeErrors(errors);
    expect(lines.some((l) => l.startsWith('Child 2:'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Child 1:'))).toBe(false);
  });

  it('rejects child names shorter than 2 characters (matches server rules)', () => {
    const form = validForm();
    form.children = [{ name: 'Y', dob: '2015-05-05', sex: 'male' }];
    const errors = validateEnrollment(form);
    expect(errors.childErrors[0]?.name).toContain('2 characters');
  });

  it('flags missing children', () => {
    const form = validForm();
    form.children = [];
    const errors = validateEnrollment(form);
    expect(errors.children).toBeTruthy();
    expect(summarizeErrors(errors).some((l) => l.startsWith('Children:'))).toBe(true);
  });
});

describe('summarizeErrors', () => {
  it('lists problems in form section order (parents → address → children → payment)', () => {
    const errors = validateEnrollment({
      father: { name: '', phone: '', email: '' },
      mother: { name: '', phone: '', email: '' },
      address_line1: '',
      city: '',
      postal_code: '',
      card_holder_name: '',
      children: [{ name: '', dob: '', sex: '' }],
    });
    const lines = summarizeErrors(errors);
    expect(lines[0]).toMatch(/^Parent/);
    expect(lines[lines.length - 1]).toMatch(/^Payment/);
    const addressIdx = lines.findIndex((l) => l.startsWith('Address:'));
    const childIdx = lines.findIndex((l) => l.startsWith('Child 1:'));
    expect(addressIdx).toBeGreaterThan(0);
    expect(childIdx).toBeGreaterThan(addressIdx);
  });

  it('includes one line per problem so the count is meaningful', () => {
    const form = validForm();
    form.postal_code = '';
    form.card_holder_name = '';
    const lines = summarizeErrors(validateEnrollment(form));
    expect(lines).toHaveLength(2);
  });
});
