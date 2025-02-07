import urlcat from 'urlcat';
import { getWalletClient } from 'wagmi/actions';
import { HubRestAPIClient } from '@standard-crypto/farcaster-js';
import { fetchJSON } from '@/helpers/fetchJSON.js';
import type { ResponseJSON } from '@/types/index.js';
import { WARPCAST_ROOT_URL } from '@/constants/index.js';
import { waitForSignedKeyRequestComplete } from '@/helpers/waitForSignedKeyRequestComplete.js';
import { generateCustodyBearer } from '@/helpers/generateCustodyBearer.js';
import {
    type PageIndicator,
    createPageable,
    createNextIndicator,
    type Pageable,
    createIndicator,
} from '@masknet/shared-base';
import { type Post, ProfileStatus, type Provider, ReactionType, Type } from '@/providers/types/SocialMedia.js';
import { WarpcastSession } from '@/providers/warpcast/Session.js';
import type {
    CastResponse,
    CastsResponse,
    FeedResponse,
    ReactionResponse,
    SuccessResponse,
    UserResponse,
    UsersResponse,
} from '@/providers/types/Warpcast.js';
import formatWarpcastPost from '@/helpers/formatWarpcastPost.js';
import { SocialPlatform } from '@/constants/enum.js';

// @ts-ignore
export class WarpcastSocialMedia implements Provider {
    private currentSession: WarpcastSession | null = null;

    get type() {
        return Type.Warpcast;
    }

    /**
     * Initiates the creation of a session by granting data access permission to another FID.
     * @param signal
     * @returns
     */
    async createSessionByGrantPermission(setUrl: (url: string) => void, signal?: AbortSignal) {
        const response = await fetchJSON<
            ResponseJSON<{
                publicKey: string;
                privateKey: string;
                fid: string;
                token: string;
                timestamp: number;
                expiresAt: number;
                deeplinkUrl: string;
            }>
        >('/api/warpcast/signin', {
            method: 'POST',
        });
        if (!response.success) throw new Error(response.error.message);

        // present QR code to the user
        setUrl(response.data.deeplinkUrl);
        console.log('DEBUG: response');
        console.log(response);

        await waitForSignedKeyRequestComplete(signal)(response.data.token);

        return new WarpcastSession(
            response.data.fid,
            response.data.privateKey,
            response.data.timestamp,
            response.data.expiresAt,
        );
    }

    /**
     * Create a session by signing the challenge with the custody wallet
     * @param signal
     * @returns
     */
    async createSessionByCustodyWallet(signal?: AbortSignal) {
        const client = await getWalletClient();
        if (!client) throw new Error('No client found');

        const { payload, token } = await generateCustodyBearer(client);
        const response = await fetchJSON<{
            result: {
                token: {
                    secret: string;
                };
            };
            errors?: Array<{ message: string; reason: string }>;
        }>(urlcat(WARPCAST_ROOT_URL, '/auth'), {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (response.errors?.length) throw new Error(response.errors[0].message);

        const { result: user } = await fetchJSON<UserResponse>(
            urlcat(WARPCAST_ROOT_URL, '/me', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${response.result.token.secret}`,
                    'Content-Type': 'application/json',
                },
            }),
        );

        return (this.currentSession = new WarpcastSession(
            user.fid.toString(),
            response.result.token.secret,
            payload.params.timestamp,
            payload.params.expiresAt,
        ));
    }

    async createSession(signal?: AbortSignal): Promise<WarpcastSession> {
        // Use the custody wallet by default
        return this.createSessionByCustodyWallet(signal);
    }

    async resumeSession(): Promise<WarpcastSession> {
        const currentTime = Date.now();

        if (this.currentSession && this.currentSession.expiresAt > currentTime) {
            return this.currentSession;
        }

        this.currentSession = await this.createSession();
        return this.currentSession;
    }

    async createClient() {
        const session = await this.createSession();
        return new HubRestAPIClient();
    }

    async discoverPosts(indicator?: PageIndicator): Promise<Pageable<Post, PageIndicator>> {
        const url = urlcat('https://client.warpcast.com/v2', '/default-recommended-feed', {
            limit: 10,
            cursor: indicator?.id,
        });

        const { result, next } = await fetchJSON<FeedResponse>(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = result.feed.map(formatWarpcastPost);
        return createPageable(data, indicator ?? createIndicator(), createNextIndicator(indicator, next.cursor));
    }

    async getPostById(postId: string): Promise<Post> {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/cast', { hash: postId });
        const { result: cast } = await fetchJSON<CastResponse>(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        });

        return {
            source: SocialPlatform.Farcaster,
            postId: cast.hash,
            parentPostId: cast.threadHash,
            timestamp: cast.timestamp,
            author: {
                profileId: cast.author.fid.toString(),
                nickname: cast.author.username,
                displayName: cast.author.displayName,
                pfp: cast.author.pfp.url,
                followerCount: cast.author.followerCount,
                followingCount: cast.author.followingCount,
                status: ProfileStatus.Active,
                verified: cast.author.pfp.verified,
            },
            metadata: {
                locale: '',
                content: {
                    content: cast.text,
                },
            },
            stats: {
                comments: cast.replies.count,
                mirrors: cast.recasts.count,
                quotes: cast.recasts.count,
                reactions: cast.reactions.count,
            },
        };
    }

    async getProfileById(profileId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/user', { fid: profileId });
        const { result: user } = await fetchJSON<UserResponse>(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        });

        return {
            profileId: user.fid.toString(),
            nickname: user.username,
            displayName: user.displayName,
            pfp: user.pfp.url,
            followerCount: user.followerCount,
            followingCount: user.followingCount,
            status: ProfileStatus.Active,
            verified: user.pfp.verified,
            viewerContext: {
                following: user.viewerContext.following,
                followedBy: user.viewerContext.followedBy,
            },
        };
    }

    async getPostsByParentPostId(
        parentPostId: string,
        indicator?: PageIndicator,
    ): Promise<Pageable<Post, PageIndicator>> {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/all-casts-in-thread', {
            threadHash: parentPostId,
        });
        const { result } = await fetchJSON<CastsResponse>(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        });

        const data = result.casts.map((cast) => {
            return {
                source: SocialPlatform.Farcaster,
                postId: cast.hash,
                parentPostId: cast.threadHash,
                timestamp: cast.timestamp,
                author: {
                    profileId: cast.author.fid.toString(),
                    nickname: cast.author.username,
                    displayName: cast.author.displayName,
                    pfp: cast.author.pfp.url,
                    followerCount: cast.author.followerCount,
                    followingCount: cast.author.followingCount,
                    status: ProfileStatus.Active,
                    verified: cast.author.pfp.verified,
                },
                metadata: {
                    locale: '',
                    content: {
                        content: cast.text,
                    },
                },
                stats: {
                    comments: cast.replies.count,
                    mirrors: cast.recasts.count,
                    quotes: cast.recasts.count,
                    reactions: cast.reactions.count,
                },
            };
        });

        return createPageable(data, indicator ?? createIndicator());
    }

    async getFollowers(profileId: string, indicator?: PageIndicator) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/followers', {
            fid: profileId,
            limit: 10,
            cursor: indicator?.id,
        });
        const { result, next } = await fetchJSON<UsersResponse>(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        });
        const data = result.map((user) => ({
            profileId: user.fid.toString(),
            nickname: user.username,
            displayName: user.displayName,
            pfp: user.pfp.url,
            followerCount: user.followerCount,
            followingCount: user.followingCount,
            status: ProfileStatus.Active,
            verified: user.pfp.verified,
            viewerContext: {
                following: user.viewerContext.following,
                followedBy: user.viewerContext.followedBy,
            },
        }));

        return createPageable(data, indicator, createNextIndicator(indicator, next.cursor));
    }

    async getFollowings(profileId: string, indicator?: PageIndicator) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/following', {
            fid: profileId,
            limit: 10,
            cursor: indicator?.id,
        });
        const { result, next } = await fetchJSON<UsersResponse>(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        });
        const data = result.map((user) => ({
            profileId: user.fid.toString(),
            nickname: user.username,
            displayName: user.displayName,
            pfp: user.pfp.url,
            followerCount: user.followerCount,
            followingCount: user.followingCount,
            status: ProfileStatus.Active,
            verified: user.pfp.verified,
            viewerContext: {
                following: user.viewerContext.following,
                followedBy: user.viewerContext.followedBy,
            },
        }));

        return createPageable(data, indicator, createNextIndicator(indicator, next.cursor));
    }

    async publishPost(post: Post): Promise<Post> {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/casts');
        const { result: cast } = await fetchJSON<CastResponse>(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: post.metadata.content }),
        });

        return {
            source: SocialPlatform.Farcaster,
            postId: cast.hash,
            parentPostId: cast.threadHash,
            timestamp: cast.timestamp,
            author: {
                profileId: cast.author.fid.toString(),
                nickname: cast.author.username,
                displayName: cast.author.displayName,
                pfp: cast.author.pfp.url,
                followerCount: cast.author.followerCount,
                followingCount: cast.author.followingCount,
                status: ProfileStatus.Active,
                verified: cast.author.pfp.verified,
            },
            metadata: {
                locale: '',
                content: {
                    content: cast.text,
                },
            },
            stats: {
                comments: cast.replies.count,
                mirrors: cast.recasts.count,
                quotes: cast.recasts.count,
                reactions: cast.reactions.count,
            },
        };
    }

    async upvotePost(postId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/cast-likes');
        const { result: reaction } = await fetchJSON<ReactionResponse>(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ castHash: postId }),
        });

        return {
            reactionId: reaction.hash,
            type: ReactionType.Upvote,
            timestamp: reaction.timestamp,
        };
    }

    async unvotePost(postId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/cast-likes');
        await fetchJSON<ReactionResponse>(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ castHash: postId }),
        });
    }

    async commentPost(postId: string, comment: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/casts', { parent: postId });
        await fetchJSON<CastResponse>(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment }),
        });
    }

    async mirrorPost(postId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/recasts');
        await fetchJSON<{ result: { castHash: string } }>(url, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ castHash: postId }),
        });

        return null!;
    }

    async unmirrorPost(postId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/recasts');
        const { result } = await fetchJSON<SuccessResponse>(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ castHash: postId }),
        });
        return result.success;
    }

    async followProfile(profileId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/follows');
        await fetchJSON<SuccessResponse>(url, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetFid: Number(profileId) }),
        });
    }

    async unfollow(profileId: string) {
        const session = await this.resumeSession();

        const url = urlcat(WARPCAST_ROOT_URL, '/follows');
        await fetchJSON<SuccessResponse>(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetFid: Number(profileId) }),
        });
    }
}

export const WarpcastSocialMediaProvider = new WarpcastSocialMedia();
