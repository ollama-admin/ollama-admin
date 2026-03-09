const SIZE_TAG_RE = /^\d+(\.\d+)?[bkmBKM]$/;

export function isSizeTag(tag: string): boolean {
  return SIZE_TAG_RE.test(tag.trim());
}

export function getSizeTags(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && isSizeTag(t));
}

export function getCapabilityTags(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && !isSizeTag(t));
}
