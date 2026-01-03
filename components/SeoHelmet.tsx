
import React, { useEffect, useState } from 'react';
import { useLocation } from '../router';

interface SeoData {
    route: string;
    title: string;
    description: string;
    keywords: string;
}

// Simple in-memory cache to avoid refetching on every route change if already loaded
let seoCache: SeoData[] | null = null;

export const SeoHelmet: React.FC = () => {
    const { pathname } = useLocation();
    const [meta, setMeta] = useState<SeoData | null>(null);

    useEffect(() => {
        const fetchSeo = async () => {
            if (seoCache) {
                const match = seoCache.find(p => p.route === pathname);
                setMeta(match || null);
                return;
            }

            try {
                // Use relative path since vite proxy is set up
                const response = await fetch('/api/seo');
                if (response.ok) {
                    const data: SeoData[] = await response.json();
                    seoCache = data;
                    const match = data.find(p => p.route === pathname);
                    setMeta(match || null);
                }
            } catch (error) {
                console.error("Failed to fetch SEO config", error);
            }
        };

        fetchSeo();
    }, [pathname]);

    useEffect(() => {
        // Default values
        let title = "تحلیلگر بورس | TSETMC Analyzer";
        let desc = "ابزار تحلیل تکنیکال و فاندامنتال بورس تهران";
        let keywords = "بورس, سهام, طلا, تحلیل تکنیکال";

        if (meta) {
            title = meta.title || title;
            desc = meta.description || desc;
            keywords = meta.keywords || keywords;
        }

        // Update Title
        document.title = title;

        // Helper to update meta tags
        const updateMeta = (name: string, content: string) => {
            let element = document.querySelector(`meta[name="${name}"]`);
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute('name', name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        // Helper to update OG tags (Open Graph)
        const updateOg = (property: string, content: string) => {
            let element = document.querySelector(`meta[property="${property}"]`);
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute('property', property);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        updateMeta('description', desc);
        updateMeta('keywords', keywords);
        
        updateOg('og:title', title);
        updateOg('og:description', desc);
        updateOg('og:url', window.location.href);

    }, [meta, pathname]);

    return null; // This component renders nothing visually
};
