import type {
  AcquireTargetContent,
  ContentDetailItem,
  ContentListItem,
  ContentRepository,
  ContentRepositoryError,
  CreateObservedContentResult,
  ImportObservedContentInput,
} from "../db/content-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";

export type FindContentDetailError = {
  code: "content_not_found";
  message: string;
};

export type ContentServiceError = ContentRepositoryError;

export interface ContentService {
  createObservedContent(
    input: ImportObservedContentInput,
  ): Promise<Result<CreateObservedContentResult, ContentServiceError>>;
  findContentAcquireTarget(
    contentId: string,
  ): Promise<AcquireTargetContent | null>;
  findContentDetail(
    contentId: string,
  ): Promise<Result<ContentDetailItem, FindContentDetailError>>;
  importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<Result<void, ContentServiceError>>;
  listContents(): Promise<ContentListItem[]>;
  markContentStatus(
    contentId: string,
    status: "discovered" | "stored" | "failed",
  ): Promise<Result<void, ContentServiceError>>;
}

export function createContentService(
  contentRepository: ContentRepository,
): ContentService {
  return {
    async createObservedContent(
      input: ImportObservedContentInput,
    ): Promise<Result<CreateObservedContentResult, ContentServiceError>> {
      return contentRepository.createObservedContent(input);
    },

    async findContentAcquireTarget(
      contentId: string,
    ): Promise<AcquireTargetContent | null> {
      return contentRepository.findContentAcquireTarget(contentId);
    },

    async findContentDetail(
      contentId: string,
    ): Promise<Result<ContentDetailItem, FindContentDetailError>> {
      const content = await contentRepository.findContentDetail(contentId);

      if (content === null) {
        return err({
          code: "content_not_found",
          message: "Content was not found.",
        });
      }

      return ok(content);
    },

    async importObservedContents(
      inputs: ImportObservedContentInput[],
    ): Promise<Result<void, ContentServiceError>> {
      return contentRepository.importObservedContents(inputs);
    },

    async listContents(): Promise<ContentListItem[]> {
      return contentRepository.listContents();
    },

    async markContentStatus(
      contentId: string,
      status: "discovered" | "stored" | "failed",
    ): Promise<Result<void, ContentServiceError>> {
      return contentRepository.markContentStatus(contentId, status);
    },
  };
}
