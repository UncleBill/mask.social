'use client';

import { SocialPlatform } from '@/constants/enum.js';
import { classNames } from '@/helpers/classNames.js';
import { useGlobalState } from '@/store/index.js';
import { getEnumAsArray } from '@masknet/kit';
import { usePathname } from 'next/navigation.js';
import { startTransition } from 'react';

export function SocialPlatformTabs() {
    const pathname = usePathname();
    const currentSocialPlatform = useGlobalState.use.currentSocialPlatform();
    const switchSocialPlatform = useGlobalState.use.switchSocialPlatform();

    if (pathname.includes('/settings') || pathname.includes('/detail')) return null;

    return (
        <div className="px-4 py-5">
            <nav className="flex space-x-4" aria-label="Tabs">
                {getEnumAsArray(SocialPlatform).map(({ key, value }) => (
                    <div
                        key={key}
                        className={classNames(
                            currentSocialPlatform === value
                                ? 'bg-main text-[#f9f9f9]'
                                : 'text-main hover:text-gray-700',
                            'rounded-md px-3 py-2 text-sm font-medium hover:cursor-pointer',
                        )}
                        aria-current={currentSocialPlatform === value ? 'page' : undefined}
                        onClick={() =>
                            startTransition(() => {
                                switchSocialPlatform(value);
                            })
                        }
                    >
                        {value}
                    </div>
                ))}
            </nav>
        </div>
    );
}
