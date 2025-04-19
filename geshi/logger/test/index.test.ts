import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  createLogger,
  createModuleLogger,
  createServiceLogger,
  setLogLevel,
} from "../src/index";

describe("Logger", () => {
  // モックの設定
  beforeEach(() => {
    // pino のメソッドをスパイ
    vi.spyOn(logger, "info");
    vi.spyOn(logger, "error");
    vi.spyOn(logger, "debug");
    vi.spyOn(logger, "warn");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("デフォルトロガーが存在する", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  it("createLogger でカスタムロガーを作成できる", () => {
    const customLogger = createLogger("test-namespace");
    expect(customLogger).toBeDefined();
    expect(customLogger.bindings()).toHaveProperty(
      "namespace",
      "test-namespace",
    );
  });

  it("createModuleLogger でモジュール用ロガーを作成できる", () => {
    const moduleLogger = createModuleLogger("test-module");
    expect(moduleLogger).toBeDefined();
    expect(moduleLogger.bindings()).toHaveProperty(
      "namespace",
      "module:test-module",
    );
  });

  it("createServiceLogger でサービス用ロガーを作成できる", () => {
    const serviceLogger = createServiceLogger("test-service");
    expect(serviceLogger).toBeDefined();
    expect(serviceLogger.bindings()).toHaveProperty(
      "namespace",
      "service:test-service",
    );
  });

  it("setLogLevel でログレベルを変更できる", () => {
    const originalLevel = logger.level;

    setLogLevel("debug");
    expect(logger.level).toBe("debug");

    setLogLevel("error");
    expect(logger.level).toBe("error");

    // 元のレベルに戻す
    setLogLevel(originalLevel as any);
  });

  it("ロガーでメッセージを出力できる", () => {
    logger.info("テスト情報メッセージ");
    expect(logger.info).toHaveBeenCalledWith("テスト情報メッセージ");

    logger.error("テストエラーメッセージ");
    expect(logger.error).toHaveBeenCalledWith("テストエラーメッセージ");
  });
});
