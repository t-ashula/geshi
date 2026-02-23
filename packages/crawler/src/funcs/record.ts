/**
 * @geshi/crawler
 * recording
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import type { RecorderResult, RecorderOptions } from "../types";
import logger from "../logger";

// 環境変数の読み込み
dotenv.config();

//  テンポラリダウンロード先ディレクトリ
const RECORDING_DIR =
  process.env.DOWNLOAD_DIR || path.join(process.cwd(), "records");

/**
 * FFmpegを使用してHLS録画を実行する
 * @param streamUrl 録画対象のストリームURL
 * @returns 録画結果
 */
function recordHLS(
  streamUrl: string,
  options: RecorderOptions,
): Promise<RecorderResult> {
  const fileName = uuidv4();
  const outputPath = path.join(RECORDING_DIR, fileName);
  // ディレクトリが存在しない場合は作成
  if (!path.dirname(outputPath)) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  const { duration } = options;
  return new Promise((resolve, reject) => {
    // FFmpegコマンドの引数
    const args: string[] = ["-i", streamUrl];
    // TODO: should we check movie/audio?
    args.push("-c", "copy"); // コーデックをコピー（変換なし）
    if (duration && duration > 0) {
      args.push("-t", `${duration}`);
    }

    args.push("-y");
    args.push(outputPath);
    logger.info(`Starting FFmpeg recording`, { args });

    // FFmpegプロセスを起動
    const ffmpeg = spawn("ffmpeg", args);

    // 標準出力のログ
    ffmpeg.stdout.on("data", (data) => {
      logger.info(`FFmpeg stdout: ${data}`);
    });

    // 標準エラー出力のログ
    ffmpeg.stderr.on("data", (data) => {
      logger.info(`FFmpeg stderr: ${data}`);
    });

    // プロセス終了時の処理
    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        try {
          // ファイルサイズを取得
          const stats = fs.statSync(outputPath);
          const result: RecorderResult = {
            outputPath,
            // TODO: 実録画時間の取得
            duration: duration ?? 0,
            size: stats.size,
            success: true,
          };
          resolve(result);
        } catch (error) {
          logger.error(`Error getting file stats: ${error}`);
          reject(error);
        }
      } else {
        logger.error(`FFmpeg process exited with code ${code}`);
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    // エラー発生時の処理
    ffmpeg.on("error", (error) => {
      logger.error(`FFmpeg process error: ${error}`);
      reject(error);
    });

    // プロセス終了時のクリーンアップ
    const cleanup = () => {
      try {
        ffmpeg.kill("SIGTERM");
      } catch (error) {
        logger.error(`Error killing FFmpeg process: ${error}`);
      }
    };

    // プロセス終了シグナルのハンドリング
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
  });
}

export { recordHLS };
