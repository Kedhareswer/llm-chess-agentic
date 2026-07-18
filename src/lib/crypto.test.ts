import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

describe("secret encryption", () => {
  const original = process.env.ENCRYPTION_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  });

  describe("with ENCRYPTION_KEY configured", () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = "test-encryption-secret";
    });

    it("round-trips a secret", () => {
      const secret = "sk-groq-abc123";
      const enc = encryptSecret(secret);
      expect(enc).not.toBe(secret);
      expect(enc.startsWith("enc:v1:")).toBe(true);
      expect(decryptSecret(enc)).toBe(secret);
    });

    it("produces a different ciphertext each time (random IV)", () => {
      expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
    });

    it("returns legacy plaintext unchanged when decrypting", () => {
      expect(decryptSecret("plain-legacy-key")).toBe("plain-legacy-key");
    });
  });

  describe("without ENCRYPTION_KEY", () => {
    beforeEach(() => {
      delete process.env.ENCRYPTION_KEY;
    });

    it("stores plaintext (no-op encrypt)", () => {
      expect(encryptSecret("plain")).toBe("plain");
    });

    it("reads plaintext back", () => {
      expect(decryptSecret("plain")).toBe("plain");
    });

    it("handles null/undefined", () => {
      expect(decryptSecret(null)).toBeNull();
      expect(decryptSecret(undefined)).toBeNull();
    });
  });
});
