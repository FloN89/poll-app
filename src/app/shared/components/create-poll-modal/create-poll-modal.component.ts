import { Component, EventEmitter, Output, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreatePollPayload,
  POLL_CATEGORIES,
  PollCategory,
  PollStatus,
} from '../../../core/models/poll.model';
import { PollService } from '../../../core/services/poll.service';
import { NotificationService } from '../../../core/services/notification.service';

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function futureDateValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  return control.value && control.value < localDateString() ? { pastDate: true } : null;
}

@Component({
  selector: 'app-create-poll-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './create-poll-modal.component.html',
  styleUrl: './create-poll-modal.component.scss',
})
export class CreatePollModalComponent {
  @Output() closed = new EventEmitter<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly pollService = inject(PollService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly categories = POLL_CATEGORIES;
  readonly minimumDeadline = localDateString();
  readonly maximumOptions = 6;
  isSaving = false;
  saveError = '';

  readonly form = this.formBuilder.group({
    status: this.formBuilder.control<PollStatus>('draft', { nonNullable: true }),
    title: this.createRequiredTextControl(''),
    description: this.formBuilder.control('', { nonNullable: true }),
    deadline: this.formBuilder.control<string | null>(null, [futureDateValidator]),
    category: this.formBuilder.control<PollCategory | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    questions: this.formBuilder.array([this.createQuestionGroup()]),
  });

  /**
   * Returns the dynamic question form array.
   */
  get questions(): FormArray {
    return this.form.controls.questions;
  }

  /**
   * Returns the option form array for one question.
   */
  optionControls(questionIndex: number): FormArray {
    return this.questions.at(questionIndex).get('options') as FormArray;
  }

  /**
   * Adds a new empty question block to the form.
   */
  addQuestion(): void {
    this.questions.push(this.createQuestionGroup());
  }

  /**
   * Removes a question block while keeping at least one question.
   */
  removeQuestion(questionIndex: number): void {
    if (this.questions.length === 1) return;

    this.questions.removeAt(questionIndex);
  }

  /**
   * Adds a new answer option to one question.
   */
  addOption(questionIndex: number): void {
    const options = this.optionControls(questionIndex);

    if (options.length >= this.maximumOptions) return;

    options.push(this.createRequiredTextControl(''));
  }

  /**
   * Removes an answer option while keeping at least two options.
   */
  removeOption(questionIndex: number, optionIndex: number): void {
    const options = this.optionControls(questionIndex);

    if (options.length <= 2) return;

    options.removeAt(optionIndex);
  }

  /**
   * Returns the alphabetical label for an answer option.
   */
  optionLetter(optionIndex: number): string {
    return String.fromCharCode(65 + optionIndex);
  }

  /**
   * Validates the form and starts saving with the selected status.
   */
  async submit(status: PollStatus): Promise<void> {
    if (!this.prepareSubmission(status)) return;

    this.isSaving = true;
    this.saveError = '';

    try {
      await this.savePoll();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Sets the requested status and checks whether the form is ready to save.
   */
  private prepareSubmission(status: PollStatus): boolean {
    if (this.isSaving) return false;

    this.form.controls.status.setValue(status);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.saveError = 'Please complete all required fields.';
      return false;
    }

    return true;
  }

  /** Creates the poll, returns home and shows a confirmation notification. */
  private async savePoll(): Promise<void> {
    const payload = this.buildPayload();
    await this.pollService.createPoll(payload);
    await this.router.navigate(['/']);
    this.notification.show('Survey published successfully.');
    this.closed.emit();
  }

  /**
   * Builds the payload object expected by the poll service.
   */
  private buildPayload(): CreatePollPayload {
    const rawValue = this.form.getRawValue();

    return {
      title: rawValue.title.trim(),
      description: rawValue.description.trim(),
      category: rawValue.category as PollCategory,
      deadline: rawValue.deadline,
      status: rawValue.status,
      questions: this.buildQuestionPayloads(rawValue.questions),
    };
  }

  /**
   * Builds all question payloads from the raw form value.
   */
  private buildQuestionPayloads(questions: CreatePollPayload['questions']) {
    return questions.map((question) => ({
      title: question.title.trim(),
      allowMultiple: question.allowMultiple,
      options: question.options.map((option) => option.trim()),
    }));
  }

  /**
   * Handles errors that happen while the survey is being saved.
   */
  private handleSaveError(error: unknown): void {
    console.error(error);
    this.saveError = 'Survey could not be saved. Please try again.';
  }

  /**
   * Creates one question form group with two empty answer fields.
   */
  private createQuestionGroup() {
    return this.formBuilder.group({
      title: this.createRequiredTextControl(''),
      allowMultiple: this.formBuilder.control(false, { nonNullable: true }),
      options: this.formBuilder.array([
        this.createRequiredTextControl(''),
        this.createRequiredTextControl(''),
      ]),
    });
  }

  /**
   * Creates a required text form control.
   */
  private createRequiredTextControl(value: string) {
    return this.formBuilder.control(value, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    });
  }
}
