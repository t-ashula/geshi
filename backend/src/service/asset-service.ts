import type {
  AcquireTargetAsset,
  AssetListItem,
  AssetRepository,
  AssetRepositoryError,
  ContentDetailAsset,
  CreateObservedAssetInput,
  CreateObservedAssetsResult,
  StoredAssetMedia,
  UpsertStoredAssetInput,
} from "../db/asset-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";

export type FindStoredMediaByIdError = {
  code: "asset_media_not_found";
  message: string;
};

export type FindAcquireTargetByIdError = {
  code: "asset_not_found";
  message: string;
};

export type AssetServiceError = AssetRepositoryError;

export interface AssetService {
  createObservedAssets(
    inputs: CreateObservedAssetInput[],
  ): Promise<Result<CreateObservedAssetsResult, AssetServiceError>>;
  findAcquireTargetById(
    assetId: string,
  ): Promise<Result<AcquireTargetAsset, FindAcquireTargetByIdError>>;
  findStoredMediaById(
    assetId: string,
  ): Promise<Result<StoredAssetMedia, FindStoredMediaByIdError>>;
  listAssets(): Promise<Result<AssetListItem[], AssetServiceError>>;
  listAssetsByContentId(contentId: string): Promise<ContentDetailAsset[]>;
  listPendingAssetsByContentId(
    contentId: string,
  ): Promise<Result<AcquireTargetAsset[], AssetServiceError>>;
  upsertStoredAsset(
    input: UpsertStoredAssetInput,
  ): Promise<Result<void, AssetServiceError>>;
}

export function createAssetService(
  assetRepository: AssetRepository,
): AssetService {
  return {
    async createObservedAssets(
      inputs: CreateObservedAssetInput[],
    ): Promise<Result<CreateObservedAssetsResult, AssetServiceError>> {
      return assetRepository.createObservedAssets(inputs);
    },

    async findAcquireTargetById(
      assetId: string,
    ): Promise<Result<AcquireTargetAsset, FindAcquireTargetByIdError>> {
      const asset = await assetRepository.findAcquireTargetById(assetId);

      if (asset === null) {
        return err({
          code: "asset_not_found",
          message: `Pending asset not found after observe: ${assetId}`,
        });
      }

      return ok(asset);
    },

    async findStoredMediaById(
      assetId: string,
    ): Promise<Result<StoredAssetMedia, FindStoredMediaByIdError>> {
      const asset = await assetRepository.findStoredMediaById(assetId);

      if (asset === null) {
        return err({
          code: "asset_media_not_found",
          message: "Stored media asset was not found.",
        });
      }

      return ok(asset);
    },

    async listAssets(): Promise<Result<AssetListItem[], AssetServiceError>> {
      return assetRepository.listAssets();
    },

    async listAssetsByContentId(
      contentId: string,
    ): Promise<ContentDetailAsset[]> {
      return assetRepository.listAssetsByContentId(contentId);
    },

    async listPendingAssetsByContentId(
      contentId: string,
    ): Promise<Result<AcquireTargetAsset[], AssetServiceError>> {
      return assetRepository.listPendingAssetsByContentId(contentId);
    },

    async upsertStoredAsset(
      input: UpsertStoredAssetInput,
    ): Promise<Result<void, AssetServiceError>> {
      return assetRepository.upsertStoredAsset(input);
    },
  };
}
