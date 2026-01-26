import { describe, it, expect } from "vitest";
import { 
  StartGameRequestSchema, 
  SetAPIKeyRequestSchema, 
  ToggleModelRequestSchema 
} from "./api";

describe("API validation schemas", () => {
  describe("StartGameRequestSchema", () => {
    it("validates valid request", () => {
      const validData = { modelIds: ["model1", "model2"] };
      const result = StartGameRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects request with less than 2 models", () => {
      const invalidData = { modelIds: ["model1"] };
      const result = StartGameRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("At least two models");
      }
    });

    it("rejects request with empty modelIds", () => {
      const invalidData = { modelIds: [] };
      const result = StartGameRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("At least two models");
      }
    });

    it("rejects request without modelIds", () => {
      const invalidData = { };
      const result = StartGameRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects request with non-array modelIds", () => {
      const invalidData = { modelIds: "not-an-array" };
      const result = StartGameRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("SetAPIKeyRequestSchema", () => {
    it("validates valid API key", () => {
      const validData = { key: "valid-key" };
      const result = SetAPIKeyRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects request with empty key", () => {
      const invalidData = { key: "" };
      const result = SetAPIKeyRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("cannot be empty");
      }
    });

    it("rejects request without key", () => {
      const invalidData = { };
      const result = SetAPIKeyRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects request with non-string key", () => {
      const invalidData = { key: 12345 };
      const result = SetAPIKeyRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("ToggleModelRequestSchema", () => {
    it("validates valid request", () => {
      const validData = { id: "model-id", active: true };
      const result = ToggleModelRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects request without id", () => {
      const invalidData = { active: true };
      const result = ToggleModelRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects request with non-string id", () => {
      const invalidData = { id: 123, active: true };
      const result = ToggleModelRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects request without active field", () => {
      const invalidData = { id: "model-id" };
      const result = ToggleModelRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects request with non-boolean active field", () => {
      const invalidData = { id: "model-id", active: "true" };
      const result = ToggleModelRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});