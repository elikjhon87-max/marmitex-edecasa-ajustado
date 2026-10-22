// Utilitários de formatação BRL e parsing robusto de moeda.

/**
 * Converte entrada do usuário (com vírgula ou ponto) em número.
 * "17,00" -> 17, "17.00" -> 17, "1.234,56" -> 1234.56, "R$ 17,00" -> 17.
 */
export function parseBRLInput(input: string): number {
  if (!input) return 0;
  let s = input.replace(/[^\d.,-]/g, '');
  // Caso tenha vírgula: vírgula é decimal. Remove pontos (separador de milhar).
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // Só ponto: assumimos que já está em formato decimal (17.00).
    // Mas se houver vários pontos, mantém apenas o último como decimal.
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
  }
  const value = parseFloat(s);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Formata número como BRL exibição: "R$ 17,00".
 */
export function formatBRL(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}

/**
 * Formata para exibição sem símbolo: "17,00".
 */
export function formatBRLPlain(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toFixed(2).replace('.', ',');
}

/**
 * Gera um PIN de 4 dígitos único dentro do conjunto passado.
 */
export function generate4DigitPIN(existing: string[] = []): string {
  const set = new Set(existing);
  let pin = '';
  let tries = 0;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    tries++;
  } while (set.has(pin) && tries < 5000);
  return pin;
}
