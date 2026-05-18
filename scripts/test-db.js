import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vmyrybmywpslyzstrmis.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '...'; // I don't know the key, wait, it's public in the repo.
