export function chunkText(text: string, size = 400): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const chunk = text.slice(start, start + size);
        chunks.push(chunk.trim());
        start += size;
    }

    return chunks;
}
