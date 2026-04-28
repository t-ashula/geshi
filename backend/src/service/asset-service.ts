import type {
  AcquireTargetAsset,
  AssetListItem,
  AssetRepository,
  CreateObservedAssetInput,
  CreateObservedAssetsResult,
  UpsertStoredAssetInput,
} from "../db/asset-repository.js";

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
}
