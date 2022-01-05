import crypto from 'crypto';

interface IRangeParameters {
    readonly bitsNeeded: number;
    readonly bytesNeeded: number;
    readonly mask: number;
}

export class Crypto {
    public static async randomNumberSafe(minimum: number, maximum: number): Promise<number> {
        if (minimum % 1 !== 0) {
            throw new Error('The minimum value must be an integer.');
        } else if (maximum % 1 !== 0) {
            throw new Error('The maximum value must be an integer.');
        }

        const range = maximum - minimum;
        if (range <= 0) {
            throw new RangeError('The maximum must be higher than the minimum.');
        } else if (range < Number.MIN_SAFE_INTEGER || range > Number.MAX_SAFE_INTEGER) {
            throw new RangeError(
                `The range must be between ${Number.MIN_SAFE_INTEGER} and ${Number.MAX_SAFE_INTEGER}.`
            );
        }

        const { bytesNeeded, mask } = this._calculateParameters(range);
        let randomValue: number;

        do {
            randomValue = 0;
            const bytes = await this._randomBytes(bytesNeeded);

            /* Turn the random bytes into an integer, using bitwise operations. */
            for (let i = 0; i < bytesNeeded; i++) {
                randomValue |= bytes[i] << (8 * i);
            }

            /* Apply bit mask */
            randomValue = randomValue & mask;

            /* Outside of the acceptable range, throw it away and try again.
             * We don't try any modulo tricks as this would introduce bias. */
        } while (randomValue > range);

        /* We've been working with 0 as a starting point,
         *so we need to add the `minimum` here. */
        return minimum + randomValue;
    }

    /**
     * @description Calculates the amount of bits and bytes required to generate a maximum value `range`.
     * Implemented with bitwise operations to avoid any floating point precision errors.
     * @param range The maximum value to generate.
     */
    private static _calculateParameters(range: number): IRangeParameters {
        let bitsNeeded = 0;
        let bytesNeeded = 0;
        let mask = 1;

        while (range > 0) {
            if (bitsNeeded % 8 === 0) {
                bytesNeeded += 1;
            }

            bitsNeeded += 1;
            mask = (mask << 1) | 1; /* 0x00001111 -> 0x00011111 */
            range = range >>> 1; /* 0x01000000 -> 0x00100000 */
        }

        return { bitsNeeded, bytesNeeded, mask };
    }

    /**
     * @description Wraps the Crypto randomBytes with a Promise.
     * @param bytesNeeded The amount of bytes to generate.
     * @returns A promise which resolves to a buffer of `bytesNeeded` bytes.
     */
    private static async _randomBytes(bytesNeeded: number): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            crypto.randomBytes(bytesNeeded, (err, bytes) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(bytes);
                }
            });
        });
    }
}
