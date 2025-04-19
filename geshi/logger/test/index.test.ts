import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  createLogger,
  createModuleLogger,
  createServiceLogger,
  setLogLevel,
} from "../src/index";

describe("Logger", () => {
  // Setup mocks
  beforeEach(() => {
    // Spy on pino methods
    vi.spyOn(logger, "info");
    vi.spyOn(logger, "error");
    vi.spyOn(logger, "debug");
    vi.spyOn(logger, "warn");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Default logger exists", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  it("Can create a custom logger with createLogger", () => {
    const customLogger = createLogger("test-namespace");
    expect(customLogger).toBeDefined();
    expect(customLogger.bindings()).toHaveProperty(
      "namespace",
      "test-namespace",
    );
  });

  it("Can create a module logger with createModuleLogger", () => {
    const moduleLogger = createModuleLogger("test-module");
    expect(moduleLogger).toBeDefined();
    expect(moduleLogger.bindings()).toHaveProperty(
      "namespace",
      "module:test-module",
    );
  });

  it("Can create a service logger with createServiceLogger", () => {
    const serviceLogger = createServiceLogger("test-service");
    expect(serviceLogger).toBeDefined();
    expect(serviceLogger.bindings()).toHaveProperty(
      "namespace",
      "service:test-service",
    );
  });

  it("Can change log level with setLogLevel", () => {
    const originalLevel = logger.level;

    setLogLevel("debug");
    expect(logger.level).toBe("debug");

    setLogLevel("error");
    expect(logger.level).toBe("error");

    // Restore original level
    setLogLevel(originalLevel as any);
  });

  it("Can output messages with logger", () => {
    logger.info("Test info message");
    expect(logger.info).toHaveBeenCalledWith("Test info message");

    logger.error("Test error message");
    expect(logger.error).toHaveBeenCalledWith("Test error message");
  });
});
