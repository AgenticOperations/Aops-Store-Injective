export class MerkleAnchorClient {
  formatPublishRootPayload(dayTimestamp: number, rootHash: string) {
    return {
      publish_daily_root: {
        day: dayTimestamp,
        root: rootHash,
      }
    };
  }
}
