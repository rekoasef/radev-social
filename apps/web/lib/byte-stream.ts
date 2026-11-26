/**
 * Chunks as a response body: reads the next one only when the browser asks for more, and stops the
 * source (closing its file) when the download is cancelled, e.g. on every seek in a video.
 */
export function byteStream(
  chunks: AsyncGenerator<Uint8Array<ArrayBuffer>, void, undefined>,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await chunks.return();
    },
  });
}
