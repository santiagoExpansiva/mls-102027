/// <mls fileReference="_102027_/l2/libUnsplash.ts" enhancement="_102027_/l2/enhancementLit" />

const clientId = 'UEmilNZzuDCesxf1L__2J4T18vdlj6jHMsdeFet3WTQ';

const cache = new Map<string, { timestamp: number; data: GetImagesResult }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutos

export async function getImages(query: string, actualPage: number, perPage: number): Promise<GetImagesResult> {
    const cacheKey = `${query}-${actualPage}-${perPage}`;
    const cached = cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.unsplash.com/search/photos?query=${encodedQuery}&page=${actualPage}&per_page=${perPage}&client_id=${clientId}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const rateRemaining = response.headers.get('x-ratelimit-remaining');
        const rateReset = response.headers.get('x-ratelimit-reset');

        if (rateRemaining && +rateRemaining <= 2) {
            console.warn(`⚠️ Aproximando do limite da API (restam ${rateRemaining} requisições). Reset: ${new Date(+rateReset! * 1000).toLocaleTimeString()}`);
        }

        const data = await response.json();

        const result: GetImagesResult = {
            currentPage: actualPage,
            totalPages: data.total_pages,
            totalResults: data.total,
            perPage,
            images: data.results
        };

        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: result
        });

        return result;

    } catch (error) {
        console.error('Erro ao buscar imagens do Unsplash:', error);
        return {
            currentPage: actualPage,
            totalPages: 0,
            totalResults: 0,
            perPage,
            images: []
        };
    }
}


export interface UnsplashImage {
    id: string;
    alt_description: string | null;
    urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
    };
}

interface GetImagesResult {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    perPage: number;
    images: UnsplashImage[];
}

export interface UnsplashSearchResponse {
    total: number;
    total_pages: number;
    results: UnsplashImage[];
}