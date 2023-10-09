import { toUtf8Bytes } from 'ethers';
import canonicalize from 'canonicalize';
import { signMessage } from 'wagmi/actions';

export interface CustodyPayload {
    method: 'generateToken';
    params: {
        timestamp: number;
        expiresAt: number;
    };
}

const ONE_DAY = 60 * 60 * 24 * 1000;

function createPayload(): CustodyPayload {
    const timestamp = Date.now();

    return {
        method: 'generateToken',
        params: {
            timestamp,
            expiresAt: timestamp + ONE_DAY,
        },
    };
}

/**
 * Generate a FC custody bearer token. (wagmi connection required)
 * @returns
 */
export async function generateCustodyBearer() {
    const message = canonicalize(createPayload());
    if (!message) throw new Error('Failed to generate custody payload.');

    const signature = await signMessage({
        message,
    });
    const signatureBase64 = Buffer.from(toUtf8Bytes(signature)).toString('base64');

    return `eip191:${signatureBase64}`;
}
