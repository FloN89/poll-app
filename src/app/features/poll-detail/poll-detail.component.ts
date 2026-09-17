import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { CreatePollModalComponent } from '../../shared/components/create-poll-modal/create-poll-modal.component';
import { Poll, PollQuestion, formatDeadline, isPollPast } from '../../core/models/poll.model';
import { PollService } from '../../core/services/poll.service';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [HeaderComponent, RouterLink, CreatePollModalComponent],
  templateUrl: './poll-detail.component.html',
  styleUrl: './poll-detail.component.scss',
})
export class PollDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pollService = inject(PollService);

  readonly poll = signal<Poll | null>(null);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly errorMessage = signal('');
  readonly submittingQuestionId = signal<string | null>(null);
  readonly selectedOptions = signal<Record<string, string[]>>({});
  readonly submittedQuestions = signal<Record<string, boolean>>({});

  private voteChannel: RealtimeChannel | null = null;
  private routeSubscription: Subscription | null = null;

  readonly formattedDeadline = computed(() => {
    const currentPoll = this.poll();

    return currentPoll ? formatDeadline(currentPoll.deadline) : '';
  });
  readonly pollClosed = computed(() => isPollPast(this.poll()?.deadline ?? null));

  async retryLoad(): Promise<void> {
    const pollId = this.route.snapshot.paramMap.get('id');

    if (pollId) await this.loadPoll(pollId);
  }

  /**
   * Loads the current poll and starts the live vote subscription.
   */
  async ngOnInit(): Promise<void> {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      void this.openPoll(params.get('id'));
    });
  }

  /**
   * Removes the live vote subscription when the page is destroyed.
   */
  async ngOnDestroy(): Promise<void> {
    this.routeSubscription?.unsubscribe();

    if (!this.voteChannel) return;

    await this.pollService.unsubscribe(this.voteChannel);
  }

  /** Loads the survey whenever its route ID changes, including same-page navigation. */
  private async openPoll(pollId: string | null): Promise<void> {
    if (this.voteChannel) {
      await this.pollService.unsubscribe(this.voteChannel);
      this.voteChannel = null;
    }

    this.poll.set(null);
    this.selectedOptions.set({});
    this.submittedQuestions.set({});

    if (!pollId || !this.isUuid(pollId)) {
      this.loading.set(false);
      return;
    }

    await this.loadPoll(pollId);
    if (this.poll()) this.voteChannel = this.createVoteSubscription(pollId);
  }

  /**
   * Loads the poll and optionally restores the current user selections.
   */
  async loadPoll(pollId: string, withSelections = true): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMessage.set('');
      await this.setLoadedPoll(pollId, withSelections);
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Survey could not be loaded. Please try again.');
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
    const optionIds = this.selectedOptions()[question.id] ?? [];

    if (!currentPoll || isPollPast(currentPoll.deadline) || optionIds.length === 0) {
      return;
    }

    try {
      this.errorMessage.set('');
      this.submittingQuestionId.set(question.id);
      await this.saveQuestionVote(currentPoll.id, question);
      await this.loadPoll(currentPoll.id, false);
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Your vote could not be saved. Please try again.');
    } finally {
      this.submittingQuestionId.set(null);
    }
  }

  /**
   * Saves answers for all questions and thanks the user.
   */
  async completeSurvey(): Promise<void> {
    const currentPoll = this.poll();

    if (!currentPoll || isPollPast(currentPoll.deadline)) return;

    try {
      this.errorMessage.set('');
      await this.submitMissingQuestions(currentPoll);
      alert('Thank you for participating!');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Your votes could not be saved. Please try again.');
    }
  }

  /**
   * Loads one poll and updates the component signal.
   */
  private async setLoadedPoll(pollId: string, withSelections: boolean): Promise<void> {
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
    currentOptions: string[],
  ): string[] {
    if (!question.allow_multiple) return [optionId];

    return this.toggleMultipleOption(optionId, currentOptions);
  }

  /**
   * Adds or removes one option in a multiple-choice question.
   */
  private toggleMultipleOption(optionId: string, currentOptions: string[]): string[] {
    if (currentOptions.includes(optionId)) {
      return currentOptions.filter((currentOptionId) => currentOptionId !== optionId);
    }

    return [...currentOptions, optionId];
  }

  /**
   * Saves the vote for one question and marks it as submitted.
   */
  private async saveQuestionVote(pollId: string, question: PollQuestion): Promise<void> {
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
      const hasSelection = (this.selectedOptions()[question.id]?.length ?? 0) > 0;

      if (!this.submittedQuestions()[question.id] && hasSelection) {
        await this.saveQuestionVote(currentPoll.id, question);
      }
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
