// Mobile format with the extra 9 digit: (00) 00000-0000.
export function maskPhoneBR(input: string): string {
  let d = input.replace(/\D/g, "");
  // Stored numbers may carry the +55 country code; drop it before masking.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCpf(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCnpj(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCpfCnpj(input: string): string {
  return input.replace(/\D/g, "").length <= 11 ? maskCpf(input) : maskCnpj(input);
}

/** Money while typing: digits become cents, shown as 1.234,56 (no currency symbol). */
export function maskMoneyBR(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${whole},${cents}`;
}
