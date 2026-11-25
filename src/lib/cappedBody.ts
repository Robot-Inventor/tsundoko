// Accumulates a response body in full while refusing to buffer more than `maxBytes`, so a huge
// response cannot exhaust memory; the first chunk past the cap stops the read.
const readCappedBody = async (body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> => {
    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of body) {
        size += chunk.byteLength;

        if (size > maxBytes) {
            throw new Error("Response body exceeded its size limit");
        }

        chunks.push(chunk);
    }

    return Buffer.concat(chunks, size);
};

export { readCappedBody };
