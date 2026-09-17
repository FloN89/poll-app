import { Injectable, inject } from '@angular/core';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import {
  CreatePollPayload,
  OptionRow,
  Poll,
  PollOption,
  PollQuestion,
  PollRow,
  QuestionRow,
  VoteRow,
} from '../models/poll.model';
import { SupabaseService } from './supabase.service';

type PollDetails = {
  questions: QuestionRow[];
  options: OptionRow[];
  votes: VoteRow[];
};

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private readonly supabase = inject(SupabaseService).client;

  /**
   * Loads all polls and enriches them with questions, options, and votes.
   */
  async getPolls(): Promise<Poll[]> {
    const { data, error } = await this.supabase
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return this.attachDetails((data ?? []).filter((poll) => !poll.title.startsWith('[Test]')));
  }

  /**
   * Loads one poll by its identifier and returns null when it is missing.
   */
  async getPoll(pollId: string): Promise<Poll | null> {
    const { data, error } = await this.supabase.from('polls').select('*').eq('id', pollId).single();

    if (this.isMissingRowError(error)) return null;
    if (error) throw error;

    return (await this.attachDetails([data]))[0] ?? null;
  }

  /**
   * Creates a poll with all related questions and answer options.
   */
  async createPoll(payload: CreatePollPayload): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_poll', {
      payload,
    });

    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Supabase returned no poll ID.');

    return data;
  }

  /**
   * Stores the selected answers for one question.
   */
  async vote(pollId: string, questionId: string, optionIds: string[]): Promise<void> {
    const { error } = await this.supabase.rpc('replace_votes', {
      target_poll_id: pollId,
      target_question_id: questionId,
      target_option_ids: [...new Set(optionIds)],
      target_voter_id: this.getVoterId(),
    });

    if (error) throw error;
  }

  /**
   * Loads the selected option identifiers for the current browser user.
   */
  async getSelectedOptionIds(questionId: string): Promise<string[]> {
    const voterId = this.getVoterId();

    const { data, error } = await this.supabase
      .from('votes')
      .select('option_id')
      .eq('question_id', questionId)
      .eq('voter_id', voterId);

    if (error) throw error;

    return (data ?? []).map((vote) => vote.option_id);
  }

  /**
   * Subscribes to vote changes for live result updates.
   */
  subscribeToVotes(pollId: string, callback: () => void): RealtimeChannel {
    return this.supabase
      .channel(`poll-votes-${pollId}`)
      .on('postgres_changes', this.getVoteSubscriptionFilter(pollId), callback)
      .subscribe();
  }

  /**
   * Removes an active Supabase realtime subscription.
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await this.supabase.removeChannel(channel);
  }

  /**
   * Returns a stable anonymous voter identifier for this browser.
   */
  getVoterId(): string {
    const storageKey = 'poll-app-voter-id';
    const existingVoterId = localStorage.getItem(storageKey);

    if (existingVoterId) return existingVoterId;

    return this.createAndStoreVoterId(storageKey);
  }

  /**
   * Adds questions, options, and vote results to raw poll rows.
   */
  private async attachDetails(polls: PollRow[]): Promise<Poll[]> {
    if (polls.length === 0) return [];

    const pollIds = polls.map((poll) => poll.id);
    const details = await this.loadPollDetails(pollIds);

    return polls.map((poll) => this.mapPollWithDetails(poll, details));
  }

  /**
   * Loads all child records needed for the given polls.
   */
  private async loadPollDetails(pollIds: string[]): Promise<PollDetails> {
    const questions = await this.fetchQuestions(pollIds);
    const questionIds = questions.map((question) => question.id);
    const [options, votes] = await Promise.all([
      this.fetchOptions(questionIds),
      this.fetchVotes(pollIds),
    ]);

    return { questions, options, votes };
  }

  /**
   * Loads all questions for the given poll identifiers.
   */
  private async fetchQuestions(pollIds: string[]): Promise<QuestionRow[]> {
    const { data, error } = await this.supabase
      .from('poll_questions')
      .select('*')
      .in('poll_id', pollIds)
      .order('position', { ascending: true });

    if (error) throw error;

    return data ?? [];
  }

  /**
   * Loads all options for the given question identifiers.
   */
  private async fetchOptions(questionIds: string[]): Promise<OptionRow[]> {
    if (questionIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('poll_options')
      .select('*')
      .in('question_id', questionIds)
      .order('position', { ascending: true });

    if (error) throw error;

    return data ?? [];
  }

  /**
   * Loads all votes for the given poll identifiers.
   */
  private async fetchVotes(pollIds: string[]): Promise<VoteRow[]> {
    const { data, error } = await this.supabase.from('votes').select('*').in('poll_id', pollIds);

    if (error) throw error;

    return data ?? [];
  }

  /**
   * Combines one poll row with its matching child records.
   */
  private mapPollWithDetails(poll: PollRow, details: PollDetails): Poll {
    const questions = details.questions
      .filter((question) => question.poll_id === poll.id)
      .map((question) => this.mapQuestionWithDetails(question, details));

    return { ...poll, questions };
  }

  /**
   * Combines one question row with its options and calculated results.
   */
  private mapQuestionWithDetails(question: QuestionRow, details: PollDetails): PollQuestion {
    const questionVotes = details.votes.filter((vote) => vote.question_id === question.id);

    return {
      ...question,
      options: this.mapOptionsWithVotes(question.id, details.options, questionVotes),
    };
  }

  /**
   * Adds vote counts and percentages to all options of one question.
   */
  private mapOptionsWithVotes(
    questionId: string,
    options: OptionRow[],
    votes: VoteRow[],
  ): PollOption[] {
    return options
      .filter((option) => option.question_id === questionId)
      .map((option) => this.mapOptionWithVotes(option, votes));
  }

  /**
   * Adds vote count and percentage values to one answer option.
   */
  private mapOptionWithVotes(option: OptionRow, votes: VoteRow[]): PollOption {
    const optionVotes = votes.filter((vote) => vote.option_id === option.id).length;
    const voterCount = new Set(votes.map((vote) => vote.voter_id)).size;
    const percentage = this.calculatePercentage(optionVotes, voterCount);

    return { ...option, votes: optionVotes, percentage };
  }

  /**
   * Calculates a rounded percentage value while avoiding division by zero.
   */
  private calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;

    return Math.round((part / total) * 100);
  }

  /**
   * Checks whether Supabase reports that a requested row does not exist.
   */
  private isMissingRowError(error: PostgrestError | null): boolean {
    return error?.code === 'PGRST116';
  }

  /**
   * Builds the Supabase realtime filter for one poll.
   */
  private getVoteSubscriptionFilter(pollId: string) {
    return {
      event: '*',
      schema: 'public',
      table: 'votes',
      filter: `poll_id=eq.${pollId}`,
    } as const;
  }

  /**
   * Creates and stores a new anonymous browser voter identifier.
   */
  private createAndStoreVoterId(storageKey: string): string {
    const voterId = crypto.randomUUID();

    localStorage.setItem(storageKey, voterId);

    return voterId;
  }
}
