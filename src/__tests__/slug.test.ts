import { slugify } from '../utils/slug.js';

describe('slugify', () => {
  it('normaliza texto', () => {
    expect(slugify('Alimento para Perros')).toBe('alimento-para-perros');
  });
  it('evita vacío', () => {
    expect(slugify('@@@')).toBe('categoria');
  });
});
