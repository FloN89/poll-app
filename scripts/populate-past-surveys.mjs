import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const environmentSource = await readFile('src/environments/environment.ts', 'utf8');
const supabaseUrl = environmentSource.match(/supabaseUrl:\s*'([^']+)/)?.[1];
const supabaseAnonKey = environmentSource.match(/supabaseAnonKey:\s*'([^']+)/)?.[1];

if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase configuration not found.');

const client = createClient(supabaseUrl, supabaseAnonKey);
const surveys = [
  {
    title: 'Summer Team Event Retrospective',
    description: 'A look back at our summer team event and the activities everyone enjoyed.',
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
    title: 'Workplace Learning Review',
    description: 'A completed survey about the learning formats and topics used by the team.',
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

for (const survey of surveys) {
  const { data: existingPoll, error: pollError } = await client
    .from('polls')
    .select('id,title')
    .eq('title', survey.title)
    .maybeSingle();

  if (pollError) throw pollError;

  let pollId = existingPoll?.id;

  if (!pollId) {
    const { data, error } = await client.rpc('create_poll', { payload: survey });

    if (error) throw error;
    pollId = data;
  }

  const { data: questions, error: questionError } = await client
    .from('poll_questions')
    .select('id,position,poll_options(id,position)')
    .eq('poll_id', pollId)
    .order('position');

  if (questionError) throw questionError;

  for (const question of questions ?? []) {
    const options = [...question.poll_options].sort(
      (first, second) => first.position - second.position,
    );

    for (let voterIndex = 1; voterIndex <= 8; voterIndex += 1) {
      const option = options[(voterIndex + question.position) % options.length];
      const { error: voteError } = await client.rpc('replace_votes', {
        target_poll_id: pollId,
        target_question_id: question.id,
        target_option_ids: [option.id],
        target_voter_id: `past-demo-${pollId}-${voterIndex}`,
      });

      if (voteError) throw voteError;
    }
  }

  console.log(JSON.stringify({ id: pollId, title: survey.title, votersPerQuestion: 8 }));
}

client.realtime.disconnect();
