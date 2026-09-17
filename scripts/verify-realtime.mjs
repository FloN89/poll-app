import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const environmentSource = await readFile('src/environments/environment.ts', 'utf8');
const supabaseUrl = environmentSource.match(/supabaseUrl:\s*'([^']+)/)?.[1];
const supabaseAnonKey = environmentSource.match(/supabaseAnonKey:\s*'([^']+)/)?.[1];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration not found.');
}

const client = createClient(supabaseUrl, supabaseAnonKey);
const testTitle = '[Test] Retrospective: Summer Team Event';
const voterId = `realtime-check-${crypto.randomUUID()}`;

const { data: poll, error: pollError } = await client
  .from('polls')
  .select('id,title')
  .eq('title', testTitle)
  .single();

if (pollError) throw pollError;

const { data: question, error: questionError } = await client
  .from('poll_questions')
  .select('id')
  .eq('poll_id', poll.id)
  .order('position')
  .limit(1)
  .single();

if (questionError) throw questionError;

const { data: option, error: optionError } = await client
  .from('poll_options')
  .select('id')
  .eq('question_id', question.id)
  .order('position')
  .limit(1)
  .single();

if (optionError) throw optionError;

let channel;

try {
  const eventReceived = new Promise((resolve, reject) => {
    let timeout;

    channel = client
      .channel(`verify-poll-votes-${poll.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `poll_id=eq.${poll.id}` },
        (event) => {
          if (event.new?.voter_id !== voterId) return;

          clearTimeout(timeout);
          resolve(event.eventType);
        },
      )
      .subscribe(async (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Realtime channel failed with status ${status}.`));
          return;
        }

        if (status !== 'SUBSCRIBED') return;

        timeout = setTimeout(() => reject(new Error('No realtime vote event received.')), 20000);

        const { error } = await client.rpc('replace_votes', {
          target_poll_id: poll.id,
          target_question_id: question.id,
          target_option_ids: [option.id],
          target_voter_id: voterId,
        });

        if (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
  });

  const eventType = await eventReceived;
  console.log(JSON.stringify({ pollId: poll.id, title: poll.title, eventType, realtime: true }));
} finally {
  await client.from('votes').delete().eq('voter_id', voterId);
  if (channel) await client.removeChannel(channel);
  client.realtime.disconnect();
}
