/**
 * Streaming JSONL parser that reads files line by line
 * without loading the entire file into memory.
 * Uses FileReader with chunking for browser compatibility.
 */

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

/**
 * Parse a JSONL file using streaming chunks
 * @param {File} file - The file to parse
 * @param {Function} onLine - Callback for each parsed line: (data, lineNumber) => void
 * @param {Function} onProgress - Progress callback: (bytesRead, totalBytes) => void
 * @param {Function} onError - Error callback for bad lines: (error, lineNumber, rawLine) => void
 * @param {Object} signal - AbortController signal for cancellation
 * @returns {Promise<{ linesProcessed, linesErrored, bytesRead }>}
 */
export async function parseJsonlFile(file, onLine, onProgress, onError, signal) {
  return new Promise((resolve, reject) => {
    let offset = 0;
    let lineNumber = 0;
    let buffer = '';
    let linesProcessed = 0;
    let linesErrored = 0;

    function readNextChunk() {
      if (signal && signal.aborted) {
        resolve({ linesProcessed, linesErrored, bytesRead: offset });
        return;
      }

      if (offset >= file.size) {
        // Process any remaining buffer
        if (buffer.trim()) {
          lineNumber++;
          try {
            const data = JSON.parse(buffer.trim());
            onLine(data, lineNumber);
            linesProcessed++;
          } catch (e) {
            linesErrored++;
            if (onError) onError(e, lineNumber, buffer.trim());
          }
        }
        resolve({ linesProcessed, linesErrored, bytesRead: offset });
        return;
      }

      const blob = file.slice(offset, offset + CHUNK_SIZE);
      const reader = new FileReader();

      reader.onload = (e) => {
        if (signal && signal.aborted) {
          resolve({ linesProcessed, linesErrored, bytesRead: offset });
          return;
        }

        buffer += e.target.result;
        offset += blob.size;

        // Split by newlines
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          lineNumber++;
          try {
            const data = JSON.parse(trimmed);
            onLine(data, lineNumber);
            linesProcessed++;
          } catch (e) {
            linesErrored++;
            if (onError) onError(e, lineNumber, trimmed);
          }
        }

        if (onProgress) {
          onProgress(offset, file.size);
        }

        // Use setTimeout to avoid blocking the UI thread
        setTimeout(readNextChunk, 0);
      };

      reader.onerror = (e) => {
        reject(new Error('FileReader error: ' + e.target.error));
      };

      reader.readAsText(blob, 'utf-8');
    }

    readNextChunk();
  });
}

/**
 * Quick preview: reads only the first N lines of the file
 * @param {File} file 
 * @param {number} maxLines 
 * @returns {Promise<Array>}
 */
export async function previewJsonlFile(file, maxLines = 100) {
  const results = [];
  let done = false;

  await parseJsonlFile(
    file,
    (data, lineNum) => {
      if (lineNum <= maxLines) {
        results.push(data);
      }
      if (lineNum >= maxLines) {
        done = true;
      }
    },
    null,
    null,
    {
      aborted: false,
      get aborted() { return done; }
    }
  );

  return results;
}

/**
 * Estimate line count based on average line size from first chunk
 * @param {File} file 
 * @returns {Promise<number>}
 */
export async function estimateLineCount(file) {
  const sampleSize = Math.min(1024 * 1024, file.size); // 1MB sample
  const blob = file.slice(0, sampleSize);
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lineCount = (text.match(/\n/g) || []).length;
      if (lineCount === 0) {
        resolve(1);
        return;
      }
      const avgLineSize = sampleSize / lineCount;
      const estimated = Math.round(file.size / avgLineSize);
      resolve(estimated);
    };
    reader.onerror = () => resolve(0);
    reader.readAsText(blob, 'utf-8');
  });
}
