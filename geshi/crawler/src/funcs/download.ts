/**
 * @geshi/crawler
 * download func
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { promisify } from "util";
import dotenv from "dotenv";
import logger from "../logger";
import { USER_AGENT } from "../const";
import { DownloaderResult } from "../types";

// 環境変数の読み込み
dotenv.config();

//  テンポラリダウンロード先ディレクトリ
const DOWNLOAD_DIR =
  process.env.DOWNLOAD_DIR || path.join(process.cwd(), "downloads");

// TODO: remove episodeId. download function should not know episode things.
/**
 * download
 * @param mediaUrl
 * @param episodeId
 * @returns
 */
async function download(mediaUrl: string): Promise<DownloaderResult> {
  // 出力先パスを生成
  const fileName = uuidv4().toString();
  const outputPath = path.join(DOWNLOAD_DIR, fileName);
  // ディレクトリが存在しない場合は作成
  if (!path.dirname(outputPath)) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  try {
    const writer = fs.createWriteStream(outputPath);

    const response = await axios({
      method: "GET",
      url: mediaUrl,
      responseType: "stream",
      headers: {
        "User-Agent": USER_AGENT,
      },
      timeout: 30000, // 30秒タイムアウト
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        const stats = await promisify(fs.stat)(outputPath);
        resolve({ success: true, size: stats.size, outputPath });
      });

      writer.on("error", (err) => {
        // エラー時はファイルを削除
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
  } catch (error) {
    logger.error(`Error downloading file`, { mediaUrl, error });
    // エラー時はファイルを削除（存在する場合）
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw error;
  }
}

export { download };
