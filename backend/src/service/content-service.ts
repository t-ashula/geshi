import type {
  ContentListItem,
  ContentRepository,
  ImportObservedContentInput,
} from "../db/content-repository.js";

export class ContentService {
  public constructor(private readonly contentRepository: ContentRepository) {}

  public async importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<void> {
    await this.contentRepository.importObservedContents(inputs);
  }

  public async listContents(): Promise<ContentListItem[]> {
    return this.contentRepository.listContents();
  }
}
