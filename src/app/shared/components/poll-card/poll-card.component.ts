import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Poll, formatDeadline, getDaysLeft, isPollPast } from '../../../core/models/poll.model';

@Component({
  selector: 'app-poll-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './poll-card.component.html',
  styleUrl: './poll-card.component.scss',
})
export class PollCardComponent {
  @Input({ required: true }) poll!: Poll;
  @Input() large = false;

  /**
   * Returns a readable deadline label for the poll card.
   */
  daysLeft(): string {
    if (isPollPast(this.poll.deadline)) {
      return `Ended on ${formatDeadline(this.poll.deadline)}`;
    }

    const days = getDaysLeft(this.poll.deadline);

    if (days === null) return 'No deadline';
    if (days === 0) return 'Ends today';
    if (days === 1) return 'Ends in 1 Day';

    return `Ends in ${days} Days`;
  }
}
