import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Poll, PollCategory } from '../../core/models/poll.model';
import { PollService } from '../../core/services/poll.service';
import { HomeComponent } from './home.component';

describe('HomeComponent survey lists', () => {
  const pollService = {
    getPolls: vi.fn().mockResolvedValue([]),
  };

  function dateOffset(days: number): string {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function createPoll(
    id: string,
    deadline: string | null,
    category: PollCategory = 'Team activities',
  ): Poll {
    return {
      id,
      title: `Survey ${id}`,
      description: '',
      category,
      status: 'published',
      deadline,
      created_at: new Date().toISOString(),
      questions: [],
    };
  }

  function createComponent(): HomeComponent {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: PollService, useValue: pollService }],
    });

    return TestBed.createComponent(HomeComponent).componentInstance;
  }

  it('shows at most three ending-soon surveys in chronological order', () => {
    const component = createComponent();
    component.polls.set([
      createPoll('third', dateOffset(3)),
      createPoll('later', dateOffset(5)),
      createPoll('first', dateOffset(1)),
      createPoll('second', dateOffset(2)),
    ]);

    expect(component.endingSoonPolls().map((poll) => poll.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('keeps active and past surveys separate while applying categories', () => {
    const component = createComponent();
    component.polls.set([
      createPoll('active-gaming', dateOffset(2), 'Gaming'),
      createPoll('active-team', dateOffset(3)),
      createPoll('past-gaming', dateOffset(-2), 'Gaming'),
    ]);

    component.selectedCategory.set('Gaming');
    expect(component.filteredPolls().map((poll) => poll.id)).toEqual(['active-gaming']);

    component.selectedTab.set('past');
    expect(component.filteredPolls().map((poll) => poll.id)).toEqual(['past-gaming']);

    component.selectedCategory.set('all');
    expect(component.filteredPolls().map((poll) => poll.id)).toEqual(['past-gaming']);
  });
});
