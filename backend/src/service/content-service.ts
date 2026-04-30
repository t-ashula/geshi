import type {
  AcquireTargetContent,
  ContentDetailItem,
  ContentListItem,
  ContentRepository,
  CreateObservedContentResult,
  ImportObservedContentInput,
} from "../db/content-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";

export type FindContentDetailError = {
  code: "content_not_found";
  message: string;
};

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
  ): Promise<Result<ContentDetailItem, FindContentDetailError>> {
    const content = await this.contentRepository.findContentDetail(contentId);

    if (content === null) {
      return err({
        code: "content_not_found",
        message: "Content was not found.",
      });
    }

    return ok(content);
  }
}
