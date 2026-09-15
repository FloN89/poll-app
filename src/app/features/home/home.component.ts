import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PollCardComponent } from '../../shared/components/poll-card/poll-card.component';
import { CreatePollModalComponent } from '../../shared/components/create-poll-modal/create-poll-modal.component';
import {
  POLL_CATEGORIES,
  Poll,
  PollCategory,
  getDaysLeft,
  isPollPast,
} from '../../core/models/poll.model';
import { PollService } from '../../core/services/poll.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent, PollCardComponent, CreatePollModalComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly pollService = inject(PollService);

  readonly polls = signal<Poll[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly modalOpen = signal(false);
  readonly selectedTab = signal<'active' | 'past'>('active');
  readonly selectedCategory = signal<PollCategory | 'all'>('all');
  readonly dropdownOpen = signal(false);
  readonly categories = POLL_CATEGORIES;

  readonly endingSoonPolls = computed(() => this.getEndingSoonPolls());
  readonly filteredPolls = computed(() => this.getFilteredPolls());

  /**
   * Loads all polls when the home page is initialized.
   */
  async ngOnInit(): Promise<void> {
    await this.loadPolls();
  }

  /**
   * Loads all polls from Supabase and updates the page state.
   */
  async loadPolls(): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMessage.set('');
      this.polls.set(await this.pollService.getPolls());
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Surveys could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Closes the creation modal and refreshes the poll list.
   */
  async closeModalAndRefresh(): Promise<void> {
    this.modalOpen.set(false);
    await this.loadPolls();
  }

  /**
   * Sets the selected category and closes the dropdown menu.
   */
  setCategory(category: PollCategory | 'all'): void {
    this.selectedCategory.set(category);
    this.dropdownOpen.set(false);
  }

  /**
   * Returns the three active polls with the nearest deadlines.
   */
  private getEndingSoonPolls(): Poll[] {
    return this.polls()
      .filter((poll) => this.isEndingSoon(poll))
      .sort((first, second) => this.sortByDeadline(first, second))
      .slice(0, 3);
  }

  /**
   * Returns all polls that match the selected tab and category.
   */
  private getFilteredPolls(): Poll[] {
    return this.polls().filter((poll) => {
      return this.matchesSelectedTab(poll) && this.matchesSelectedCategory(poll);
    });
  }

  /**
   * Checks whether a poll ends within the next three days.
   */
  private isEndingSoon(poll: Poll): boolean {
    const days = getDaysLeft(poll.deadline);

    return days !== null && days <= 3 && !isPollPast(poll.deadline);
  }

  /**
   * Sorts polls by their deadline date.
   */
  private sortByDeadline(first: Poll, second: Poll): number {
    const firstDate = first.deadline ?? '9999-12-31';
    const secondDate = second.deadline ?? '9999-12-31';

    return firstDate.localeCompare(secondDate);
  }

  /**
   * Checks whether a poll matches the active or past tab.
   */
  private matchesSelectedTab(poll: Poll): boolean {
    if (this.selectedTab() === 'active') return !isPollPast(poll.deadline);

    return isPollPast(poll.deadline);
  }

  /**
   * Checks whether a poll matches the selected category filter.
   */
  private matchesSelectedCategory(poll: Poll): boolean {
    const category = this.selectedCategory();

    return category === 'all' || poll.category === category;
  }
}
