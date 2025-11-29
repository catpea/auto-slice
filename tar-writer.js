// Modern ES Module tarball writer for browsers
// Pure ESM, no external dependencies

function pad(value, length, padChar = ' ') {
  let s = String(value);
  while (s.length < length) {
    s = padChar + s;
  }
  return s;
}

function encodeOctal(value, length) {
  let s = value.toString(8);
  if (s.length > length - 1) {
    s = Array(length).fill('7').join('');
  }
  s = pad(s, length - 1, '0');
  return (s + '\0').split('').map(ch => ch.charCodeAt(0));
}

function stringToBytes(str, length) {
  const encoder = new TextEncoder();
  let bytes = encoder.encode(str);
  if (bytes.length > length) {
    bytes = bytes.slice(0, length);
  }
  if (bytes.length < length) {
    bytes = Uint8Array.from([...bytes, ...new Array(length - bytes.length).fill(0)]);
  }
  return bytes;
}

function checksum(header) {
  let sum = 0;
  for (let i = 0; i < 512; ++i) {
    if (i >= 148 && i < 156) {
      sum += 0x20;
    } else {
      sum += header[i];
    }
  }
  return sum;
}

export class TarWriter {
  constructor() {
    this.entries = [];
    this.addedDirs = new Set();
  }

  addFile(filepath, data, opts = {}) {
    if (!filepath) throw new Error("File path is required");
    filepath = filepath.replace(/\\/g, '/');

    const dirnames = this._extractParentDirs(filepath);
    for (const dir of dirnames) {
      this._addDirectoryIfNeeded(dir, opts);
    }

    let content;
    if (typeof data === 'string') {
      content = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      content = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      content = data;
    } else {
      throw new Error("Unsupported file data type");
    }

    this.entries.push({
      type: 'file',
      name: filepath,
      content,
      mode: opts.mode || 0o644,
      uid: opts.uid || 0,
      gid: opts.gid || 0,
      mtime: opts.mtime || Math.floor(Date.now() / 1000),
    });
  }

  addDirectory(dirname, opts = {}) {
    dirname = dirname.replace(/\\/g, '/');
    if (!dirname.endsWith('/')) dirname += '/';
    this._addDirectoryIfNeeded(dirname, opts);
  }

  generate() {
    let chunks = [];

    for (const entry of this.entries) {
      let header = new Uint8Array(512);
      header.set(stringToBytes(entry.name, 100), 0);
      header.set(encodeOctal(entry.mode, 8), 100);
      header.set(encodeOctal(entry.uid, 8), 108);
      header.set(encodeOctal(entry.gid, 8), 116);
      header.set(
        encodeOctal(entry.type === 'dir' ? 0 : entry.content.length, 12),
        124
      );
      header.set(encodeOctal(entry.mtime, 12), 136);
      for (let i = 148; i < 156; ++i) header[i] = 0x20;
      header[156] = entry.type === 'dir' ? '5'.charCodeAt(0) : '0'.charCodeAt(0);
      header.set(stringToBytes('', 100), 157);
      header.set(stringToBytes('ustar', 6), 257);
      header.set(stringToBytes('00', 2), 263);
      header.set(stringToBytes('', 32), 265);
      header.set(stringToBytes('', 32), 297);
      header.set(encodeOctal(0, 8), 329);
      header.set(encodeOctal(0, 8), 337);
      header.set(stringToBytes('', 155), 345);

      let cksum = checksum(header);
      header.set(encodeOctal(cksum, 8), 148);

      chunks.push(header);

      if (entry.type === 'file') {
        chunks.push(entry.content);
        let remainder = entry.content.length % 512;
        if (remainder !== 0) {
          chunks.push(new Uint8Array(512 - remainder));
        }
      }
    }

    chunks.push(new Uint8Array(512));
    chunks.push(new Uint8Array(512));

    let totalLength = chunks.reduce((a, b) => a + b.length, 0);
    let tarball = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of chunks) {
      tarball.set(part, offset);
      offset += part.length;
    }
    return tarball;
  }

  _addDirectoryIfNeeded(dirname, opts = {}) {
    if (!dirname.endsWith('/')) dirname += '/';
    if (this.addedDirs.has(dirname)) return;
    this.entries.push({
      type: 'dir',
      name: dirname,
      mode: opts.mode || 0o755,
      uid: opts.uid || 0,
      gid: opts.gid || 0,
      mtime: opts.mtime || Math.floor(Date.now() / 1000),
      content: null,
    });
    this.addedDirs.add(dirname);
  }

  _extractParentDirs(filepath) {
    const parts = filepath.split('/');
    let dirs = [];
    for (let i = 1; i < parts.length; ++i) {
      let dir = parts.slice(0, i).join('/');
      if (dir && !dir.endsWith('/')) dir += '/';
      if (dir) dirs.push(dir);
    }
    return dirs;
  }
}
