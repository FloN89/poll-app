import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { Poll, PollQuestion, formatDeadline } from '../../core/models/poll.model';
import { PollService } from '../../core/services/poll.service';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [HeaderComponent, RouterLink],
  templateUrl: './poll-detail.component.html',
  styleUrl: './poll-detail.component.scss',
})
export class PollDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pollService = inject(PollService);

  readonly poll = signal<Poll | null>(null);
  readonly loading = signal(true);
  readonly selectedOptions = signal<Record<string, string[]>>({});
  readonly submittedQuestions = signal<Record<string, boolean>>({});

  private voteChannel: RealtimeChannel | null = null;

  readonly formattedDeadline = computed(() => {
    const currentPoll = this.poll();

    return currentPoll ? formatDeadline(currentPoll.deadline) : '';
  });

  /**
   * Loads the current poll and starts the live vote subscription.
   */
  async ngOnInit(): Promise<void> {
    const pollId = this.route.snapshot.paramMap.get('id');

    if (!pollId) return;

    await this.loadPoll(pollId);
    this.voteChannel = this.createVoteSubscription(pollId);
  }

  /**
   * Removes the live vote subscription when the page is destroyed.
   */
  async ngOnDestroy(): Promise<void> {
    if (!this.voteChannel) return;

    await this.pollService.unsubscribe(this.voteChannel);
  }

  /**
   * Loads the poll and optionally restores the current user selections.
   */
  async loadPoll(pollId: string, withSelections = true): Promise<void> {
    try {
      this.loading.set(true);
      await this.setLoadedPoll(pollId, withSelections);
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Returns the alphabetical label for an answer option.
   */
  optionLetter(optionIndex: number): string {
    return String.fromCharCode(65 + optionIndex);
  }

  /**
   * Checks whether one answer option is currently selected.
   */
  isChecked(questionId: string, optionId: string): boolean {
    return this.selectedOptions()[questionId]?.includes(optionId) ?? false;
  }

  /**
   * Toggles one option depending on the question selection type.
   */
  toggleOption(question: PollQuestion, optionId: string): void {
    const currentOptions = this.selectedOptions()[question.id] ?? [];
    const nextOptions = this.getNextSelectedOptions(question, optionId, currentOptions);

    this.selectedOptions.set({
      ...this.selectedOptions(),
      [question.id]: nextOptions,
    });
  }

  /**
   * Saves the selected answers for one question.
   */
  async submitQuestion(question: PollQuestion): Promise<void> {
    const currentPoll = this.poll();

    if (!currentPoll) return;

    await this.saveQuestionVote(currentPoll.id, question);
    await this.loadPoll(currentPoll.id, false);
  }

  /**
   * Saves answers for all questions and thanks the user.
   */
  async completeSurvey(): Promise<void> {
    const currentPoll = this.poll();

    if (!currentPoll) return;

    await this.submitMissingQuestions(currentPoll);
    alert('Thank you for participating!');
  }

  /**
   * Loads one poll and updates the component signal.
   */
  private async setLoadedPoll(
    pollId: string,
    withSelections: boolean
  ): Promise<void> {
    const loadedPoll = await this.pollService.getPoll(pollId);

    this.poll.set(loadedPoll);

    if (loadedPoll && withSelections) await this.restoreSelections(loadedPoll);
  }

  /**
   * Restores already selected answers for the current browser user.
   */
  private async restoreSelections(currentPoll: Poll): Promise<void> {
    const selections: Record<string, string[]> = {};

    for (const question of currentPoll.questions) {
      selections[question.id] = await this.pollService.getSelectedOptionIds(question.id);
    }

    this.selectedOptions.set(selections);
  }

  /**
   * Creates a realtime subscription for vote changes of the current poll.
   */
  private createVoteSubscription(pollId: string): RealtimeChannel {
    return this.pollService.subscribeToVotes(pollId, () => {
      void this.loadPoll(pollId, false);
    });
  }

  /**
   * Returns the next selected option list for one question.
   */
  private getNextSelectedOptions(
    question: PollQuestion,
    optionId: string,
    currentOptions: string[]
  ): string[] {
    if (!question.allow_multiple) return [optionId];

    return this.toggleMultipleOption(optionId, currentOptions);
  }

  /**
   * Adds or removes one option in a multiple-choice question.
   */
  private toggleMultipleOption(
    optionId: string,
    currentOptions: string[]
  ): string[] {
    if (currentOptions.includes(optionId)) {
      return currentOptions.filter((currentOptionId) => currentOptionId !== optionId);
    }

    return [...currentOptions, optionId];
  }

  /**
   * Saves the vote for one question and marks it as submitted.
   */
  private async saveQuestionVote(
    pollId: string,
    question: PollQuestion
  ): Promise<void> {
    const optionIds = this.selectedOptions()[question.id] ?? [];

    await this.pollService.vote(pollId, question.id, optionIds);
    this.markQuestionAsSubmitted(question.id);
  }

  /**
   * Marks one question as submitted in the local state.
   */
  private markQuestionAsSubmitted(questionId: string): void {
    this.submittedQuestions.set({
      ...this.submittedQuestions(),
      [questionId]: true,
    });
  }

  /**
   * Submits all questions that have not been submitted yet.
   */
  private async submitMissingQuestions(currentPoll: Poll): Promise<void> {
    for (const question of currentPoll.questions) {
      if (!this.submittedQuestions()[question.id]) {
        await this.saveQuestionVote(currentPoll.id, question);
      }
    }
  }
}