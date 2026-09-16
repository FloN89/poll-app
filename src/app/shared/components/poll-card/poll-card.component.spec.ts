import { describe, expect, it, vi } from 'vitest';
import { Poll } from '../../../core/models/poll.model';
import { PollCardComponent } from './poll-card.component';

describe('PollCardComponent', () => {
  it('shows the actual deadline for a past survey', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 18, 30));

    const component = new PollCardComponent();
    component.poll = createPoll('2026-09-15');

    expect(component.daysLeft()).toBe('Ended on 15.9.2026');

    vi.useRealTimers();
  });
});

function createPoll(deadline: string): Poll {
  return {
    id: 'poll-id',
    title: 'Past survey',
    description: '',
    category: 'Team activities',
    status: 'published',
    deadline,
    created_at: '2026-09-01T00:00:00Z',
    questions: [],
  };
}
