import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: 'website' | 'image' | 'video';
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

/**
 * LinkPreview - Displays rich previews for URLs
 * 
 * Features:
 * - Auto-linkify URLs
 * - Generate link previews with title, description, thumbnail
 * - Support for YouTube, Twitter, GitHub
 * - Inline image/video previews
 * 
 * Requirements: 34.10, 34.11, 45.1-45.6
 */
export const LinkPreview: React.FC<LinkPreviewProps> = ({ url, className = '' }) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLinkMetadata();
  }, [url]);

  const fetchLinkMetadata = async () => {
    try {
      setLoading(true);
      setError(false);

      // Check if it's a direct image or video URL
      if (isDirectImageUrl(url)) {
        setMetadata({
          url,
          type: 'image'
        });
        setLoading(false);
        return;
      }

      if (isDirectVideoUrl(url)) {
        setMetadata({
          url,
          type: 'video'
        });
        setLoading(false);
        return;
      }

      // For other URLs, fetch metadata (in production, this would call a backend endpoint)
      // For now, we'll use a mock implementation
      const mockMetadata = await getMockMetadata(url);
      setMetadata(mockMetadata);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch link metadata:', err);
      setError(true);
      setLoading(false);
    }
  };

  const isDirectImageUrl = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  const isDirectVideoUrl = (url: string): boolean => {
    return /\.(mp4|webm|ogg)$/i.test(url);
  };

  const getMockMetadata = async (url: string): Promise<LinkMetadata> => {
    // Mock implementation - in production, this would call a backend service
    // that fetches Open Graph tags or uses a service like Microlink
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    // YouTube detection
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return {
        url,
        title: 'YouTube Video',
        description: 'Watch this video on YouTube',
        siteName: 'YouTube',
        type: 'video'
      };
    }

    // GitHub detection
    if (url.includes('github.com')) {
      return {
        url,
        title: 'GitHub Repository',
        description: 'View this repository on GitHub',
        siteName: 'GitHub',
        type: 'website'
      };
    }

    // Twitter detection
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return {
        url,
        title: 'Tweet',
        description: 'View this tweet',
        siteName: 'Twitter',
        type: 'website'
      };
    }

    // Generic website
    return {
      url,
      title: new URL(url).hostname,
      description: 'Click to visit this website',
      type: 'website'
    };
  };

  if (loading) {
    return (
      <Card className={`my-2 ${className}`}>
        <CardContent className="p-3">
          <div className="flex gap-3">
            <Skeleton className="w-20 h-20 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metadata) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1"
      >
        {url}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  // Direct image preview
  if (metadata.type === 'image') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`my-2 ${className}`}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Shared image"
            className="max-w-full max-h-96 rounded-lg hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </a>
      </motion.div>
    );
  }

  // Direct video preview
  if (metadata.type === 'video') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`my-2 ${className}`}
      >
        <video
          src={url}
          controls
          className="max-w-full max-h-96 rounded-lg"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </motion.div>
    );
  }

  // Rich link preview
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`my-2 ${className}`}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardContent className="p-3">
            <div className="flex gap-3">
              {metadata.image && (
                <div className="w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-muted">
                  <img
                    src={metadata.image}
                    alt={metadata.title || 'Link preview'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              {!metadata.image && (
                <div className="w-20 h-20 flex-shrink-0 rounded bg-muted flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {metadata.siteName && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {metadata.siteName}
                  </div>
                )}
                {metadata.title && (
                  <div className="font-medium text-sm line-clamp-1 mb-1">
                    {metadata.title}
                  </div>
                )}
                {metadata.description && (
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {metadata.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {new URL(url).hostname}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </a>
    </motion.div>
  );
};

/**
 * Auto-linkify text content
 */
export const linkifyText = (text: string): React.ReactNode[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return <LinkPreview key={index} url={part} />;
    }
    return <span key={index}>{part}</span>;
  });
};
