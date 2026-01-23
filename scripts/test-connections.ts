import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnections() {
  console.log('🔍 Testing all connections...\n');

  // Test Supabase
  console.log('1️⃣ Testing Supabase...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test scores table
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .limit(1);

    if (scoresError) throw scoresError;
    console.log('   ✅ Supabase scores table: OK');

    // Test photos table
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .limit(1);

    if (photosError) throw photosError;
    console.log('   ✅ Supabase photos table: OK');

    // Test queue table
    const { data: queue, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .limit(1);

    if (queueError) throw queueError;
    console.log('   ✅ Supabase queue table: OK');

    // Test storage bucket
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) throw bucketsError;
    const photosBucket = buckets.find(b => b.name === 'photos');
    if (photosBucket) {
      console.log('   ✅ Supabase photos bucket: OK');
    } else {
      console.log('   ⚠️ Supabase photos bucket: NOT FOUND');
    }

  } catch (error) {
    console.log('   ❌ Supabase error:', error);
  }

  // Test Anthropic
  console.log('\n2️⃣ Testing Anthropic...');
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "Connection successful!" and nothing else.' }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('   ✅ Anthropic:', text.trim());
  } catch (error) {
    console.log('   ❌ Anthropic error:', error);
  }

  // Test GitHub
  console.log('\n3️⃣ Testing GitHub...');
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'CoPlanner-Test'
      }
    });

    if (response.ok) {
      const user = await response.json();
      console.log('   ✅ GitHub: Authenticated as', user.login);
    } else {
      console.log('   ⚠️ GitHub: Status', response.status);
    }
  } catch (error) {
    console.log('   ❌ GitHub error:', error);
  }

  console.log('\n✨ Connection tests complete!');
}

testConnections();
