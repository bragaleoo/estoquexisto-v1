import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rmoiwobfdvqtnbqjnesi.supabase.co';
const supabaseKey = 'sb_publishable_xo5VYyhNFR8M-MuCwzwKzg_vdD1l1wq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching credenciamentos...");
  const { data, error } = await supabase.from('credenciamentos').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} credenciamentos:`);
    console.log(JSON.stringify(data.slice(-10), null, 2));
  }

  console.log("Fetching consultores...");
  const { data: cData, error: cError } = await supabase.from('consultores').select('*');
  if (cError) {
    console.error("Error:", cError);
  } else {
    console.log(`Found ${cData.length} consultores:`);
    console.log(JSON.stringify(cData.slice(0, 5), null, 2));
  }
}

run();
