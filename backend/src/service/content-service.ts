import type {
  AcquireTargetContent,
  ContentDetailItem,
  ContentListItem,
  ContentRepository,
  CreateObservedContentResult,
  ImportObservedContentInput,
} from "../db/content-repository.js";

export class ContentService {
  public constructor(private readonly contentRepository: ContentRepository) {}

  public async importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<void> {
    await this.contentRepository.importObservedContents(inputs);
  }

  public async createObservedContent(
    input: ImportObservedContentInput,
  ): Promise<CreateObservedContentResult> {
    return this.contentRepository.createObservedContent(input);
  }

  public async markContentStatus(
    contentId: string,
    status: "discovered" | "stored" | "failed",
  ): Promise<void> {
    await this.contentRepository.markContentStatus(contentId, status);
  }

  public async findContentAcquireTarget(
    contentId: string,
  ): Promise<AcquireTargetContent | null> {
    return this.contentRepository.findContentAcquireTarget(contentId);
  }

  public async listContents(): Promise<ContentListItem[]> {
    return this.contentRepository.listContents();
  }

  public async findContentDetail(
    contentId: string,
  ): Promise<ContentDetailItem | null> {
    return this.contentRepository.findContentDetail(contentId);
  }
}
