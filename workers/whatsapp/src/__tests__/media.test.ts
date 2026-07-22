import { describe, it, expect } from 'vitest';
import { bufferToDataUri } from '../media';

describe('bufferToDataUri', () => {
  it('encodes a buffer as base64 data URI', () => {
    const text = 'Hello, World!';
    const buffer = new TextEncoder().encode(text).buffer;
    const result = bufferToDataUri(buffer, 'text/plain');
    expect(result).toBe(`data:text/plain;base64,${btoa(text)}`);
  });

  it('handles image/jpeg content type', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const dataUri = bufferToDataUri(bytes.buffer, 'image/jpeg');
    expect(dataUri).toMatch(/^data:image\/jpeg;base64,/);
    expect(dataUri).toContain('/9j/4AAQSkZJRg');
  });

  it('handles image/png content type', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const dataUri = bufferToDataUri(bytes.buffer, 'image/png');
    expect(dataUri).toMatch(/^data:image\/png;base64,/);
  });

  it('handles empty buffer', () => {
    const dataUri = bufferToDataUri(new ArrayBuffer(0), 'application/octet-stream');
    expect(dataUri).toBe('data:application/octet-stream;base64,');
  });

  it('handles large buffer', () => {
    const buffer = new ArrayBuffer(1024);
    const dataUri = bufferToDataUri(buffer, 'image/jpeg');
    expect(dataUri).toMatch(/^data:image\/jpeg;base64,/);
    expect(dataUri.length).toBeGreaterThan(1000);
  });
});
