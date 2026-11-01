/** Browser-only image decoding; the application receives this as an adapter. */
export async function loadImageAssets(data) {
  const pending = new Map();
  const entries = data.items
    .map((item) => [item.id, item.preview])
    .concat(
      (data.objects || []).map((item) => [item.id, item.asset]),
      (data.objects || [])
        .filter((item) => item.posterAsset)
        .map((item) => ["poster:" + item.id, item.posterAsset]),
    );
  await Promise.all(
    entries.map(
      ([id, src]) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            pending.set(id, image);
            resolve();
          };
          image.onerror = () =>
            reject(Error("An image in this JSON could not be loaded."));
          image.src = src;
        }),
    ),
  );
  return pending;
}
