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

export class AssetService {
  public constructor(private readonly assetRepository: AssetRepository) {}

  public async createObservedAssets(
    inputs: CreateObservedAssetInput[],
  ): Promise<Result<CreateObservedAssetsResult, AssetServiceError>> {
    return this.assetRepository.createObservedAssets(inputs);
  }

  public async upsertStoredAsset(
    input: UpsertStoredAssetInput,
  ): Promise<Result<void, AssetServiceError>> {
    return this.assetRepository.upsertStoredAsset(input);
  }

  public async listPendingAssetsByContentId(
    contentId: string,
  ): Promise<Result<AcquireTargetAsset[], AssetServiceError>> {
    return this.assetRepository.listPendingAssetsByContentId(contentId);
  }

  public async findAcquireTargetById(
    assetId: string,
  ): Promise<Result<AcquireTargetAsset, FindAcquireTargetByIdError>> {
    const asset = await this.assetRepository.findAcquireTargetById(assetId);

    if (asset === null) {
      return err({
        code: "asset_not_found",
        message: `Pending asset not found after observe: ${assetId}`,
      });
    }

    return ok(asset);
  }

  public async listAssets(): Promise<
    Result<AssetListItem[], AssetServiceError>
  > {
    return this.assetRepository.listAssets();
  }

  public async listAssetsByContentId(
    contentId: string,
  ): Promise<ContentDetailAsset[]> {
    return this.assetRepository.listAssetsByContentId(contentId);
  }

  public async findStoredMediaById(
    assetId: string,
  ): Promise<Result<StoredAssetMedia, FindStoredMediaByIdError>> {
    const asset = await this.assetRepository.findStoredMediaById(assetId);

    if (asset === null) {
      return err({
        code: "asset_media_not_found",
        message: "Stored media asset was not found.",
      });
    }

    return ok(asset);
  }
}
