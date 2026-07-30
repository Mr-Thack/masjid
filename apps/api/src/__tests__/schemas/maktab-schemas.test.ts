import { describe, it, expect } from 'vitest';
import {
  ParentSchema,
  ChildSchema,
  EnrollmentSchema,
  SquareEnrollmentSchema,
  TermCreateSchema,
  SettingsUpdateSchema,
} from '@masjid/schemas';

describe('ParentSchema', () => {
  it('accepts empty parent (all optional)', () => {
    expect(() => ParentSchema.parse({})).not.toThrow();
  });

  it('accepts complete parent info', () => {
    const result = ParentSchema.parse({ name: 'Dad', phone: '+14155552671', email: 'dad@test.com' });
    expect(result.name).toBe('Dad');
    expect(result.phone).toBe('+14155552671');
    expect(result.email).toBe('dad@test.com');
  });

  it('rejects partial parent (name only)', () => {
    expect(() => ParentSchema.parse({ name: 'Dad' })).toThrow();
  });

  it('rejects partial parent (name + phone, no email)', () => {
    expect(() => ParentSchema.parse({ name: 'Dad', phone: '+14155552671' })).toThrow();
  });

  it('rejects partial parent (name + email, no phone)', () => {
    expect(() => ParentSchema.parse({ name: 'Dad', email: 'dad@test.com' })).toThrow();
  });

  it('rejects invalid phone number', () => {
    expect(() => ParentSchema.parse({ name: 'Dad', phone: '123', email: 'dad@test.com' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => ParentSchema.parse({ name: 'Dad', phone: '+14155552671', email: 'not-an-email' })).toThrow();
  });

  it('accepts UK phone', () => {
    expect(() => ParentSchema.parse({ name: 'Dad', phone: '+447911123456', email: 'dad@test.com' })).not.toThrow();
  });
});

describe('ChildSchema', () => {
  it('accepts valid child', () => {
    const result = ChildSchema.parse({ name: 'Ali', dob: '2015-01-01', sex: 'male' });
    expect(result.name).toBe('Ali');
  });

  it('rejects name shorter than 2 characters', () => {
    expect(() => ChildSchema.parse({ name: 'A', dob: '2015-01-01', sex: 'male' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => ChildSchema.parse({ name: '', dob: '2015-01-01', sex: 'male' })).toThrow();
  });

  it('rejects invalid dob format', () => {
    expect(() => ChildSchema.parse({ name: 'Ali', dob: '01/01/2015', sex: 'male' })).toThrow();
  });

  it('rejects invalid sex', () => {
    expect(() => ChildSchema.parse({ name: 'Ali', dob: '2015-01-01', sex: 'other' })).toThrow();
  });

  it('accepts female sex', () => {
    expect(() => ChildSchema.parse({ name: 'Fatima', dob: '2017-03-15', sex: 'female' })).not.toThrow();
  });
});

describe('EnrollmentSchema', () => {
  const base = {
    address_line1: '123 Main St',
    city: 'Atlanta',
    postal_code: '30303',
    children: [{ name: 'Ali', dob: '2015-01-01', sex: 'male' }],
  };

  it('accepts enrollment with complete father', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
    })).not.toThrow();
  });

  it('accepts enrollment with complete mother', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      mother: { name: 'Mom', phone: '+14155552672', email: 'mom@test.com' },
    })).not.toThrow();
  });

  it('rejects enrollment with no parent', () => {
    expect(() => EnrollmentSchema.parse(base)).toThrow();
  });

  it('rejects enrollment with incomplete father', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad' },
    })).toThrow();
  });

  it('rejects enrollment with incomplete mother', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      mother: { name: 'Mom', phone: '+14155552672' },
    })).toThrow();
  });

  it('rejects short address', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
      address_line1: 'St',
    })).toThrow();
  });

  it('rejects short city', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
      city: 'A',
    })).toThrow();
  });

  it('rejects bad ZIP format', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
      postal_code: 'abc',
    })).toThrow();
  });

  it('accepts ZIP+4 format', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
      postal_code: '30303-1234',
    })).not.toThrow();
  });

  it('rejects empty children', () => {
    expect(() => EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
      children: [],
    })).toThrow();
  });

  it('defaults country to US', () => {
    const result = EnrollmentSchema.parse({
      ...base,
      father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
    });
    expect(result.country).toBe('US');
  });
});

describe('SquareEnrollmentSchema', () => {
  const base = {
    father: { name: 'Dad', phone: '+14155552671', email: 'dad@test.com' },
    address_line1: '123 Main St',
    city: 'Atlanta',
    postal_code: '30303',
    children: [{ name: 'Ali', dob: '2015-01-01', sex: 'male' }],
  };

  it('accepts valid Square enrollment', () => {
    expect(() => SquareEnrollmentSchema.parse({
      ...base,
      source_id: 'cnon:card_token',
      card_holder_name: 'Test Dad',
    })).not.toThrow();
  });

  it('rejects missing source_id', () => {
    expect(() => SquareEnrollmentSchema.parse({
      ...base,
      card_holder_name: 'Test Dad',
    })).toThrow();
  });

  it('rejects empty source_id', () => {
    expect(() => SquareEnrollmentSchema.parse({
      ...base,
      source_id: '',
      card_holder_name: 'Test Dad',
    })).toThrow();
  });

  it('rejects missing card_holder_name', () => {
    expect(() => SquareEnrollmentSchema.parse({
      ...base,
      source_id: 'cnon:card_token',
    })).toThrow();
  });

  it('rejects empty card_holder_name', () => {
    expect(() => SquareEnrollmentSchema.parse({
      ...base,
      source_id: 'cnon:card_token',
      card_holder_name: '',
    })).toThrow();
  });
});

describe('TermCreateSchema', () => {
  it('accepts valid term', () => {
    const result = TermCreateSchema.parse({
      name: 'Fall 2026',
      length_months: 4,
      price_cents_1: 10000,
      price_cents_2: 16000,
      price_cents_3plus: 20000,
    });
    expect(result.name).toBe('Fall 2026');
  });

  it('rejects empty name', () => {
    expect(() => TermCreateSchema.parse({
      name: '', length_months: 3,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('rejects length_months < 1', () => {
    expect(() => TermCreateSchema.parse({
      name: 'T', length_months: 0,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('rejects length_months > 12', () => {
    expect(() => TermCreateSchema.parse({
      name: 'T', length_months: 13,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('rejects negative price', () => {
    expect(() => TermCreateSchema.parse({
      name: 'T', length_months: 3,
      price_cents_1: -100, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('rejects zero price', () => {
    expect(() => TermCreateSchema.parse({
      name: 'T', length_months: 3,
      price_cents_1: 0, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('rejects non-integer price', () => {
    expect(() => TermCreateSchema.parse({
      name: 'T', length_months: 3,
      price_cents_1: 10.5, price_cents_2: 2000, price_cents_3plus: 3000,
    })).toThrow();
  });

  it('accepts minimum valid length_months (1)', () => {
    expect(() => TermCreateSchema.parse({
      name: 'Monthly', length_months: 1,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    })).not.toThrow();
  });

  it('accepts maximum valid length_months (12)', () => {
    expect(() => TermCreateSchema.parse({
      name: 'Yearly', length_months: 12,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    })).not.toThrow();
  });
});

describe('SettingsUpdateSchema', () => {
  it('accepts empty update (all optional)', () => {
    expect(() => SettingsUpdateSchema.parse({})).not.toThrow();
  });

  it('accepts setting enrollment_open', () => {
    expect(() => SettingsUpdateSchema.parse({ enrollment_open: true })).not.toThrow();
  });

  it('accepts setting active_term_id', () => {
    expect(() => SettingsUpdateSchema.parse({ active_term_id: 'some-id' })).not.toThrow();
  });

  it('accepts null active_term_id (unset)', () => {
    expect(() => SettingsUpdateSchema.parse({ active_term_id: null })).not.toThrow();
  });

  it('accepts status_message', () => {
    expect(() => SettingsUpdateSchema.parse({ status_message: 'Coming soon' })).not.toThrow();
  });

  it('accepts null status_message', () => {
    expect(() => SettingsUpdateSchema.parse({ status_message: null })).not.toThrow();
  });

  it('rejects non-boolean enrollment_open', () => {
    expect(() => SettingsUpdateSchema.parse({ enrollment_open: 'yes' })).toThrow();
  });

  it('accepts all fields together', () => {
    expect(() => SettingsUpdateSchema.parse({
      active_term_id: 'term-1',
      enrollment_open: true,
      status_message: 'Limited spots available',
    })).not.toThrow();
  });

  it('accepts assistance_code', () => {
    expect(() => SettingsUpdateSchema.parse({ assistance_code: 'A1B2C3' })).not.toThrow();
  });

  it('accepts null assistance_code (clear)', () => {
    expect(() => SettingsUpdateSchema.parse({ assistance_code: null })).not.toThrow();
  });

  it('accepts empty assistance_code', () => {
    expect(() => SettingsUpdateSchema.parse({ assistance_code: '' })).not.toThrow();
  });
});