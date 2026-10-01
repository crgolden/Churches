import type { ChurchRecord, CorrectionRecord } from '../test-data.js';

export class ScenarioContext {
  readonly scriptErrors: string[] = [];
  readonly directoryRequests: string[] = [];

  forgetDirectoryRequests(): void {
    this.directoryRequests.splice(0);
  }
  private churchValue: ChurchRecord | null = null;
  private neighboursValue: readonly ChurchRecord[] = [];
  private correctionValue: Omit<CorrectionRecord, 'createdAt'> | null = null;
  private readerPositionValue: number | null = null;
  private createdIdValue: string | null = null;

  get createdId(): string {
    if (this.createdIdValue === null) {
      throw new Error('The scenario reads what it added before a When added anything.');
    }
    return this.createdIdValue;
  }

  set createdId(id: string) {
    this.createdIdValue = id;
  }

  get church(): ChurchRecord {
    if (this.churchValue === null) {
      throw new Error('The scenario reads its church before a Given listed one.');
    }
    return this.churchValue;
  }

  set church(church: ChurchRecord) {
    this.churchValue = church;
  }

  get neighbours(): readonly ChurchRecord[] {
    return this.neighboursValue;
  }

  set neighbours(churches: readonly ChurchRecord[]) {
    this.neighboursValue = churches;
  }

  get correction(): Omit<CorrectionRecord, 'createdAt'> {
    if (this.correctionValue === null) {
      throw new Error('The scenario reads its correction before a Given queued one.');
    }
    return this.correctionValue;
  }

  set correction(correction: Omit<CorrectionRecord, 'createdAt'>) {
    this.correctionValue = correction;
  }

  get readerPosition(): number {
    if (this.readerPositionValue === null) {
      throw new Error("The scenario checks the reader's place before a Given scrolled the results.");
    }
    return this.readerPositionValue;
  }

  set readerPosition(position: number) {
    this.readerPositionValue = position;
  }
}
