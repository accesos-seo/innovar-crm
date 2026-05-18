import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("No supabase credentials configured in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log("Testing connection to:", url);
  const start = Date.now();
  try {
    const { data, error, count } = await supabase.from('clients').select('*', { count: 'exact' });
    console.log("Result in", Date.now() - start, "ms", { count, error });
  } catch(e) {
    console.error("Exception:", e);
  }
}
test();
