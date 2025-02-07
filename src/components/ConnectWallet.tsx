'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { disconnect } from 'wagmi/actions';

export function ConnectWallet() {
    const account = useAccount();

    return (
        <>
            {account.isConnected ? (
                <div className="mt-4">
                    <pre>{account.address}</pre>
                    <button onClick={() => disconnect()}>&gt; Disconnect Wallet</button>
                </div>
            ) : (
                <ConnectButton />
            )}
        </>
    );
}
