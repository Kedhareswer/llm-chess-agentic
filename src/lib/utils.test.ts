import { describe, it, expect } from "vitest";
import { formatElapsed, sanitizeId } from "./utils";

describe("Utility functions", () => {
  describe("formatElapsed", () => {
    it("formats seconds correctly", () => {
      expect(formatElapsed(0)).toBe("00:00");
      expect(formatElapsed(1000)).toBe("00:01"); // 1 second
      expect(formatElapsed(59000)).toBe("00:59"); // 59 seconds
    });

    it("formats minutes correctly", () => {
      expect(formatElapsed(60000)).toBe("01:00"); // 1 minute
      expect(formatElapsed(120000)).toBe("02:00"); // 2 minutes
      expect(formatElapsed(3599000)).toBe("59:59"); // 59 minutes 59 seconds
    });

    it("formats hours correctly", () => {
      expect(formatElapsed(3600000)).toBe("01:00:00"); // 1 hour
      expect(formatElapsed(7200000)).toBe("02:00:00"); // 2 hours
      expect(formatElapsed(3661000)).toBe("01:01:01"); // 1 hour 1 min 1 sec
    });

    it("handles negative values", () => {
      expect(formatElapsed(-1000)).toBe("00:00"); // should return 00:00 for negative values
    });
  });

  describe("sanitizeId", () => {
    it("sanitizes special characters", () => {
      expect(sanitizeId("model/id")).toBe("model_id");
      expect(sanitizeId("model.id")).toBe("model_id");
      expect(sanitizeId("model@id")).toBe("model_id");
      expect(sanitizeId("model id")).toBe("model_id");
    });

    it("preserves alphanumeric characters and allowed symbols", () => {
      expect(sanitizeId("abc123")).toBe("abc123");
      expect(sanitizeId("model-name_test")).toBe("model-name_test");
    });

    it("handles empty string", () => {
      expect(sanitizeId("")).toBe("");
    });

    it("handles complex strings", () => {
      expect(sanitizeId("groq/llama-3.1-8b@instant!")).toBe("groq_llama-3_1-8b_instant_");
    });
  });
});