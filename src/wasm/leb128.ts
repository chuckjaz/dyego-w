export function writeUnsigned(bytes: Uint8Array, offset: number, value: bigint): number {
    let current = offset;
    do {
        const byte = Number(value & 0x7fn);
        value >>= 7n;
        if (value != 0n) /* more bytes to come */
            bytes[current++] = byte | 0x80;
        else bytes[current++] = byte          
    } while (value != 0n);
    return current - offset;      
}

export function readUnsigned(bytes: Uint8Array, offset: number): bigint {
    let result = 0n;
    let current = offset;
    let shift = 0n;
    while (true) {
      const byte = bytes[current++]
      result |= BigInt(byte & 0x7F) << shift;
      if ((byte & 0x80) == 0)
        break;
      shift += 7n;
    }
    return result
}

export function writeSigned(bytes: Uint8Array, offset: number, value: bigint): number {
    let current = offset
    while (true) {
      const byte = Number(value & 0x7fn);
      value >>= 7n;
      if (
        (value === 0n && (byte & 0x40) === 0) ||
        (value === -1n && (byte & 0x40) !== 0)
      ) {
        bytes[current++] = byte
        break
      }
      bytes[current++] = byte | 0x80
    }
    return current - offset
}

export function readSigned(bytes: Buffer, offset: number): bigint {
    let current = offset
    let result = 0n;
    let shift = 0n;
    let byte    
    do {
      byte = bytes[current++];
      result |= BigInt(byte & 0x7F) << shift;
      shift += 7n;
    } while ((byte & 0x80) != 0);
    
    if ((byte & 0x40) != 0)
      result |= (~0n << shift);    

    return result
}