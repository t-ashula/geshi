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
  ): Promise<StoredAssetMedia | null> {
    return this.assetRepository.findStoredMediaById(assetId);
  }
}
