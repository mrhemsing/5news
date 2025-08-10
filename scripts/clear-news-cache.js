const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY:',
    supabaseKey ? 'Found' : 'Missing'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearNewsCache() {
  try {
    console.log('Clearing news cache...');

    const { error } = await supabase
      .from('news_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (error) {
      console.error('Error clearing news cache:', error);
    } else {
      console.log('News cache cleared successfully!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

clearNewsCache();
