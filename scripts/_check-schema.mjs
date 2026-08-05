import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from("product_sizes").select("*").limit(1);
if (data && data.length) console.log("product_sizes:", JSON.stringify(Object.keys(data[0])));
else console.log("product_sizes: empty");
const { data: d2 } = await supabase.from("product_colors").select("*").limit(1);
if (d2 && d2.length) console.log("product_colors:", JSON.stringify(Object.keys(d2[0])));
else console.log("product_colors: empty");