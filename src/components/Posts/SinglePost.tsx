import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Post } from '@/providers/types/SocialMedia.js';
import { PostHeader } from './PostHeader.js';
import { PostBody } from './PostBody.js';

interface SinglePost {
    post: Post;
}
export const SinglePost = memo<SinglePost>(function SinglePost({ post }) {
    return (
        <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cursor-pointer px-4 py-3"
        >
            <PostHeader post={post} />
            <PostBody post={post} />
        </motion.article>
    );
});
