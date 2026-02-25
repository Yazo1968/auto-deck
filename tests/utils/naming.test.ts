import { describe, it, expect } from 'vitest';
import { getUniqueName, isNameTaken } from '../../utils/naming';

describe('getUniqueName', () => {
  it('returns the original name when no conflict exists', () => {
    expect(getUniqueName('Foo', ['Bar', 'Baz'])).toBe('Foo');
  });

  it('returns the original name when the list is empty', () => {
    expect(getUniqueName('Report', [])).toBe('Report');
  });

  it('appends (2) on first conflict', () => {
    expect(getUniqueName('Foo', ['Foo'])).toBe('Foo (2)');
  });

  it('increments counter past existing conflicts', () => {
    expect(getUniqueName('Foo', ['Foo', 'Foo (2)', 'Foo (3)'])).toBe('Foo (4)');
  });

  it('is case-insensitive', () => {
    expect(getUniqueName('foo', ['FOO'])).toBe('foo (2)');
  });

  it('inserts counter before file extension when isFile is true', () => {
    expect(getUniqueName('report.pdf', ['report.pdf'], true)).toBe('report (2).pdf');
  });

  it('increments file counter past existing conflicts', () => {
    expect(getUniqueName('report.pdf', ['report.pdf', 'report (2).pdf'], true)).toBe('report (3).pdf');
  });

  it('handles files with no extension', () => {
    expect(getUniqueName('Makefile', ['Makefile'], true)).toBe('Makefile (2)');
  });
});

describe('isNameTaken', () => {
  it('returns false when the name is not in the list', () => {
    expect(isNameTaken('Alpha', ['Beta', 'Gamma'])).toBe(false);
  });

  it('returns true when the name exists (case-insensitive)', () => {
    expect(isNameTaken('alpha', ['Alpha', 'Beta'])).toBe(true);
  });

  it('trims whitespace before comparing', () => {
    expect(isNameTaken('  Alpha  ', ['Alpha'])).toBe(true);
  });

  it('excludes the self name from comparison', () => {
    expect(isNameTaken('Alpha', ['Alpha', 'Beta'], 'Alpha')).toBe(false);
  });

  it('still detects conflict with others when excludeSelf is set', () => {
    expect(isNameTaken('Beta', ['Alpha', 'Beta'], 'Alpha')).toBe(true);
  });
});
