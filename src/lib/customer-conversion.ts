import { supabase } from "@/integrations/supabase/client";

export type CustomerConversionInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
};

type CustomerMatch = { id: string; email: string | null; phone: string | null };

const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase("pt-BR") || null;

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? digits : null;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || "Cliente", lastName: parts.join(" ") };
}

export async function ensureCustomerForApprovedQuote(
  input: CustomerConversionInput,
): Promise<{ id: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;
  const normalizedPhone = normalizePhone(phone);
  let existing: CustomerMatch | null = null;

  if (email) {
    const { data, error } = await supabase
      .from("customers" as never)
      .select("id, email, phone")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível buscar o cliente por e-mail: ${error.message}`);
    existing = data as unknown as CustomerMatch | null;
  }

  if (!existing && normalizedPhone) {
    const { data, error } = await supabase
      .from("customers" as never)
      .select("id, email, phone")
      .not("phone", "is", null)
      .limit(500);
    if (error) throw new Error(`Não foi possível buscar o cliente por telefone: ${error.message}`);
    existing =
      ((data ?? []) as unknown as CustomerMatch[]).find(
        (customer) => normalizePhone(customer.phone) === normalizedPhone,
      ) ?? null;
  }

  const { firstName, lastName } = splitName(input.name);
  const basePayload: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    address_1: input.address?.trim() || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("customers" as never)
      .update(basePayload as never)
      .eq("id", existing.id);
    if (error) throw new Error(`Cliente encontrado, mas não pôde ser atualizado: ${error.message}`);
    return { id: existing.id, created: false };
  }

  const extendedPayload = {
    ...basePayload,
    cpf: input.cpf?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
  };
  let result = await supabase
    .from("customers" as never)
    .insert(extendedPayload as never)
    .select("id")
    .single();

  if (result.error && /column .* does not exist/i.test(result.error.message)) {
    result = await supabase
      .from("customers" as never)
      .insert(basePayload as never)
      .select("id")
      .single();
  }

  if (result.error || !result.data) {
    throw new Error(
      `Não foi possível cadastrar o cliente: ${result.error?.message ?? "registro não retornado"}`,
    );
  }

  return { id: (result.data as unknown as { id: string }).id, created: true };
}
