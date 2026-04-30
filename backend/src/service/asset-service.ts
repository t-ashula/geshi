import type {
  AcquireTargetAsset,
  AssetListItem,
  AssetRepository,
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

export class AssetService {
  public constructor(private readonly assetRepository: AssetRepository) {}

  public async createObservedAssets(
    inputs: CreateObservedAssetInput[],
  ): Promise<CreateObservedAssetsResult> {
    return this.assetRepository.createObservedAssets(inputs);
  }

  public async upsertStoredAsset(input: UpsertStoredAssetInput): Promise<void> {
    await this.assetRepository.upsertStoredAsset(input);
  }

  public async listPendingAssetsByContentId(
    contentId: string,
  ): Promise<AcquireTargetAsset[]> {
    return this.assetRepository.listPendingAssetsByContentId(contentId);
  }

  public async findAcquireTargetById(
    assetId: string,
  ): Promise<AcquireTargetAsset | null> {
    return this.assetRepository.findAcquireTargetById(assetId);
  }

  public async listAssets(): Promise<AssetListItem[]> {
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
