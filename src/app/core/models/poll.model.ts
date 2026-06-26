export type PollCategory =
  | 'Team activities'
  | 'Health & Wellness'
  | 'Healthy Lifestyle'
  | 'Gaming'
  | 'Gaming & Entertainment'
  | 'Education & Learning'
  | 'Lifestyle & Personal'
  | 'Technology & Innovation';

export type PollStatus = 'draft' | 'published';

export interface PollRow {
  id: string;
  title: string;
  description: string | null;
  category: PollCategory;
  status: PollStatus;
  deadline: string | null;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  poll_id: string;
  title: string;
  allow_multiple: boolean;
  position: number;
  created_at: string;
}

export interface OptionRow {
  id: string;
  question_id: string;
  text: string;
  position: number;
  created_at: string;
}

export interface VoteRow {
  id: string;
  poll_id: string;
  question_id: string;
  option_id: string;
  voter_id: string;
  created_at: string;
}

export interface PollOption extends OptionRow {
  votes: number;
  percentage: number;
}

export interface PollQuestion extends QuestionRow {
  options: PollOption[];
}

export interface Poll extends PollRow {
  questions: PollQuestion[];
}

export interface CreatePollPayload {
  title: string;
  description: string;
  category: PollCategory;
  deadline: string | null;
  status: PollStatus;
  questions: Array<{
    title: string;
    allowMultiple: boolean;
    options: string[];
  }>;
}

export const POLL_CATEGORIES: PollCategory[] = [
  'Team activities',
  'Health & Wellness',
  'Gaming & Entertainment',
  'Education & Learning',
  'Lifestyle & Personal',
  'Technology & Innovation',
];

/**
 * Calculates how many full or partial days are left until the deadline.
 */
export function getDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null;

  const today = new Date();
  const endDate = new Date(`${deadline}T23:59:59`);
  const difference = endDate.getTime() - today.getTime();

  return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)));
}

/**
 * Checks whether a poll deadline is already in the past.
 */
export function isPollPast(deadline: string | null): boolean {
  if (!deadline) return false;

  return new Date(`${deadline}T23:59:59`).getTime() < Date.now();
}

/**
 * Formats a database date string for the visible poll detail page.
 */
export function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'No deadline';

  const date = new Date(`${deadline}T00:00:00`);
  return new Intl.DateTimeFormat('de-DE').format(date);
}