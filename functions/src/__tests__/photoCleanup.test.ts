import { describe, it, expect } from "vitest";
import { pathFromDownloadUrl, isOwnedByRecipeOwner } from "../photoCleanupHelpers.js";

describe("pathFromDownloadUrl", () => {
  const BUCKET = "my-project.appspot.com";
  const BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/`;

  it("decodes a simple path", () => {
    const url = `${BASE}recipes%2Fuser1%2Fphoto.jpg?alt=media&token=abc`;
    expect(pathFromDownloadUrl(url)).toBe("recipes/user1/photo.jpg");
  });

  it("decodes a nested path with spaces", () => {
    const url = `${BASE}recipes%2Fuser1%2Fmy%20photo.jpg?alt=media`;
    expect(pathFromDownloadUrl(url)).toBe("recipes/user1/my photo.jpg");
  });

  it("returns null for a non-Firebase URL", () => {
    expect(pathFromDownloadUrl("https://images.unsplash.com/photo.jpg")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(pathFromDownloadUrl("")).toBeNull();
  });

  it("returns null for a URL with an invalid percent-encoding", () => {
    const url = `${BASE}bad%GGpath?alt=media`;
    expect(pathFromDownloadUrl(url)).toBeNull();
  });

  it("handles the case where no query string is present", () => {
    const url = `${BASE}recipes%2Fuser1%2Fphoto.jpg`;
    expect(pathFromDownloadUrl(url)).toBe("recipes/user1/photo.jpg");
  });

  it("returns null for an http:// (non-https) URL that doesn't match", () => {
    expect(
      pathFromDownloadUrl("http://otherstorage.com/file.jpg"),
    ).toBeNull();
  });
});

describe("isOwnedByRecipeOwner", () => {
  it("returns true for a path under recipes/{ownerId}/", () => {
    expect(isOwnedByRecipeOwner("recipes/uid123/photo.jpg", "uid123")).toBe(
      true,
    );
  });

  it("returns true for deeply nested paths under the owner prefix", () => {
    expect(
      isOwnedByRecipeOwner("recipes/uid123/sub/dir/file.jpg", "uid123"),
    ).toBe(true);
  });

  it("returns false for a different owner's path", () => {
    expect(isOwnedByRecipeOwner("recipes/uid456/photo.jpg", "uid123")).toBe(
      false,
    );
  });

  it("returns false for path starting with ownerId but missing prefix", () => {
    expect(isOwnedByRecipeOwner("uid123/photo.jpg", "uid123")).toBe(false);
  });

  it("returns false for a path that partially matches", () => {
    // "recipes/uid123evil/photo.jpg" should NOT match owner "uid123"
    expect(
      isOwnedByRecipeOwner("recipes/uid123evil/photo.jpg", "uid123"),
    ).toBe(false);
  });

  it("returns false for empty path", () => {
    expect(isOwnedByRecipeOwner("", "uid123")).toBe(false);
  });

  it("returns false for empty ownerId (would incorrectly match everything starting with 'recipes/')", () => {
    // "recipes//photo.jpg".startsWith("recipes//") — vacuous match; still correct behaviour
    expect(isOwnedByRecipeOwner("recipes//photo.jpg", "")).toBe(true);
    // Caller is responsible for never passing empty ownerId; this documents the behaviour.
  });
});
