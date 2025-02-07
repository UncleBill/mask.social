import { Image } from '@/esm/Image.js';

interface AccountCardProps {
    avatar: string;
    name: string;
    userName: string;
    logout: () => void;
    isCurrent: boolean;
    type: 'lens' | 'farcaster';
}
export function AccountCard({ avatar, name, userName, logout, isCurrent, type }: AccountCardProps) {
    return (
        <div className="inline-flex h-[63px] w-full items-center justify-start gap-[8px] rounded-lg bg-white px-[12px] py-[8px] shadow backdrop-blur-lg">
            <div className="flex h-[40px] w-[48px] items-start justify-start">
                <div className="relative h-[40px] w-[40px]">
                    <div className="absolute left-0 top-0 h-[36px] w-[36px] rounded-[99px] shadow backdrop-blur-lg">
                        <Image src={avatar} alt="avatar" width={36} height={36} />
                    </div>
                    <Image
                        className="absolute left-[24px] top-[24px] h-[16px] w-[16px] rounded-[99px] border border-white shadow"
                        src={type === 'lens' ? '/svg/lens.svg' : '/svg/farcaster.svg'}
                        alt="logo"
                        width={16}
                        height={16}
                    />
                </div>
            </div>
            <div className="inline-flex shrink grow basis-0 flex-col items-start justify-center gap-1">
                <div className="font-['PingFang SC'] text-base font-medium text-neutral-900">{name}</div>
                <div className="font-['PingFang SC'] text-[15px] font-normal text-neutral-500">@{userName}</div>
            </div>
            {isCurrent ? (
                <button className="font-['Inter'] text-xs font-medium leading-none text-red-500">Log out</button>
            ) : (
                <button className="text-right font-['Inter'] text-xs font-medium leading-none text-neutral-900">
                    Switch
                </button>
            )}
        </div>
    );
}
