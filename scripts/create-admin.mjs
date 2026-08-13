// Run with:
//   node --env-file=.dev.vars --env-file=.env scripts/create-admin.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const EMAIL = "contato@arteno.com.br";
const PASSWORD = "123mudar";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser(email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function main() {
  let user = await findUser(EMAIL);
  if (user) {
    console.log("User already exists:", user.id);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("Created user:", user.id);
  }

  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: user.id, role: "admin" });
  if (roleErr && !/duplicate key/i.test(roleErr.message)) {
    throw roleErr;
  }
  console.log("Admin role ensured for", EMAIL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
