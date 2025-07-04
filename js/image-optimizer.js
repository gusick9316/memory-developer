class ImageOptimizer {
    constructor() {
        this.imageCache = new Map();
        this.loadingImages = new Set();
        this.observer = null;
        this.initLazyLoading();
    }

    // 지연 로딩 초기화
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px' // 50px 전에 미리 로딩
            });
        }
    }

    // 이미지 압축
    async compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // 원본 비율 유지하면서 크기 조정
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;

                // 이미지 그리기
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 압축된 이미지 반환
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // 이미지 리사이징 (여러 크기 생성)
    async createResponsiveImages(file) {
        const sizes = [
            { name: 'thumbnail', width: 150, quality: 0.7 },
            { name: 'medium', width: 400, quality: 0.8 },
            { name: 'large', width: 800, quality: 0.85 }
        ];

        const results = {};
        
        for (const size of sizes) {
            results[size.name] = await this.compressImage(file, size.width, size.quality);
        }

        return results;
    }

    // 이미지 지연 로딩 설정
    setupLazyLoading(img, src) {
        if (this.observer) {
            img.dataset.src = src;
            img.classList.add('lazy-image');
            this.observer.observe(img);
        } else {
            // IntersectionObserver 미지원 시 즉시 로딩
            this.loadImage(img, src);
        }
    }

    // 이미지 로딩
    async loadImage(img, src = null) {
        const imageSrc = src || img.dataset.src;
        if (!imageSrc || this.loadingImages.has(imageSrc)) return;

        this.loadingImages.add(imageSrc);

        try {
            // 캐시 확인
            if (this.imageCache.has(imageSrc)) {
                img.src = this.imageCache.get(imageSrc);
                img.classList.add('loaded');
                return;
            }

            // 로딩 상태 표시
            img.classList.add('loading');

            // 이미지 프리로드
            const preloadImg = new Image();
            preloadImg.onload = () => {
                img.src = imageSrc;
                img.classList.remove('loading');
                img.classList.add('loaded');
                this.imageCache.set(imageSrc, imageSrc);
                this.loadingImages.delete(imageSrc);
            };

            preloadImg.onerror = () => {
                img.classList.remove('loading');
                img.classList.add('error');
                this.loadingImages.delete(imageSrc);
            };

            preloadImg.src = imageSrc;

        } catch (error) {
            console.error('Image loading failed:', error);
            img.classList.remove('loading');
            img.classList.add('error');
            this.loadingImages.delete(imageSrc);
        }
    }

    // WebP 지원 확인
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    // 최적화된 이미지 URL 생성
    getOptimizedImageUrl(originalUrl) {
        if (this.supportsWebP()) {
            // WebP 지원 시 WebP 버전 요청 (GitHub에서 지원하지 않으므로 주석 처리)
            // return originalUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        }
        return originalUrl;
    }

    // 이미지 캐시 정리
    clearCache() {
        this.imageCache.clear();
        this.loadingImages.clear();
    }

    // 메모리 사용량 모니터링
    getCacheSize() {
        return this.imageCache.size;
    }

    // 이미지 프리로딩 (중요한 이미지들)
    async preloadImages(urls) {
        const promises = urls.map(url => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.imageCache.set(url, url);
                    resolve();
                };
                img.onerror = resolve; // 에러가 나도 계속 진행
                img.src = url;
            });
        });

        await Promise.all(promises);
    }
}

// 전역 이미지 최적화 인스턴스
window.imageOptimizer = new ImageOptimizer();

