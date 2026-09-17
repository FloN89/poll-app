import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const environmentSource = await readFile('src/environments/environment.ts', 'utf8');
const supabaseUrl = environmentSource.match(/supabaseUrl:\s*'([^']+)/)?.[1];
const supabaseAnonKey = environmentSource.match(/supabaseAnonKey:\s*'([^']+)/)?.[1];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration not found.');
}

const client = createClient(supabaseUrl, supabaseAnonKey);
const payloads = [
  {
    title: '[Test] Retrospective: Summer Team Event',
    description: 'Past test survey for checking the archive, results, and responsive layout.',
    category: 'Team activities',
    deadline: '2026-08-28',
    status: 'published',
    questions: [
      {
        title: 'Which activity did you enjoy most?',
        allowMultiple: false,
        options: ['Outdoor games', 'Team dinner', 'Workshop'],
      },
      {
        title: 'What should we repeat next time?',
        allowMultiple: true,
        options: ['Longer breaks', 'Mixed teams', 'More food choices'],
      },
    ],
  },
  {
    title: '[Test] Completed Workplace Learning Survey',
    description: 'Past test survey for validating filters and the completed survey view.',
    category: 'Education & Learning',
    deadline: '2026-09-05',
    status: 'published',
    questions: [
      {
        title: 'Which learning format worked best?',
        allowMultiple: false,
        options: ['Live workshop', 'Video course', 'Peer session'],
      },
      {
        title: 'Which topics were most useful?',
        allowMultiple: true,
        options: ['Communication', 'Technology', 'Project planning'],
      },
    ],
  },
];

const titles = payloads.map(({ title }) => title);
const { data: existing, error: readError } = await client
  .from('polls')
  .select('id,title,deadline')
  .in('title', titles);

if (readError) throw readError;

const results = (existing ?? []).map((row) => ({ ...row, state: 'already existed' }));

for (const payload of payloads.filter(
  ({ title }) => !(existing ?? []).some((row) => row.title === title),
)) {
  const { data, error } = await client.rpc('create_poll', { payload });

  if (error) throw error;
  results.push({ id: data, title: payload.title, deadline: payload.deadline, state: 'created' });
}

console.log(JSON.stringify(results, null, 2));
