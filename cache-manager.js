// 캐싱 시스템 관리자
class CacheManager {
    constructor() {
        this.cachePrefix = 'memoryStorage_';
        this.cacheExpiry = 30 * 60 * 1000; // 30분
        this.maxCacheSize = 50 * 1024 * 1024; // 50MB
        this.compressionEnabled = true;
    }

    // 캐시 키 생성
    generateKey(type, identifier) {
        return `${this.cachePrefix}${type}_${identifier}`;
    }

    // 데이터 압축
    compress(data) {
        if (!this.compressionEnabled) return data;
        try {
            return LZString.compress(JSON.stringify(data));
        } catch (error) {
            console.warn('Compression failed:', error);
            return JSON.stringify(data);
        }
    }

    // 데이터 압축 해제
    decompress(compressedData) {
        if (!this.compressionEnabled) return JSON.parse(compressedData);
        try {
            const decompressed = LZString.decompress(compressedData);
            return decompressed ? JSON.parse(decompressed) : JSON.parse(compressedData);
        } catch (error) {
            console.warn('Decompression failed:', error);
            return JSON.parse(compressedData);
        }
    }

    // 캐시에 데이터 저장
    set(key, data, customExpiry = null) {
        try {
            const cacheItem = {
                data: this.compress(data),
                timestamp: Date.now(),
                expiry: customExpiry || this.cacheExpiry,
                size: JSON.stringify(data).length
            };

            const cacheKey = this.generateKey('data', key);
            localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
            
            // 캐시 크기 관리
            this.manageCacheSize();
            
            return true;
        } catch (error) {
            console.error('Cache set failed:', error);
            return false;
        }
    }

    // 캐시에서 데이터 가져오기
    get(key) {
        try {
            const cacheKey = this.generateKey('data', key);
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) return null;

            const cacheItem = JSON.parse(cached);
            const now = Date.now();

            // 만료 확인
            if (now - cacheItem.timestamp > cacheItem.expiry) {
                this.delete(key);
                return null;
            }

            return this.decompress(cacheItem.data);
        } catch (error) {
            console.error('Cache get failed:', error);
            return null;
        }
    }

    // 캐시 삭제
    delete(key) {
        try {
            const cacheKey = this.generateKey('data', key);
            localStorage.removeItem(cacheKey);
            return true;
        } catch (error) {
            console.error('Cache delete failed:', error);
            return false;
        }
    }

    // 캐시 크기 관리
    manageCacheSize() {
        try {
            const cacheKeys = this.getAllCacheKeys();
            let totalSize = 0;
            const cacheItems = [];

            // 모든 캐시 아이템 크기 계산
            cacheKeys.forEach(key => {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const cacheItem = JSON.parse(cached);
                    totalSize += cacheItem.size;
                    cacheItems.push({
                        key: key,
                        timestamp: cacheItem.timestamp,
                        size: cacheItem.size
                    });
                }
            });

            // 최대 크기 초과 시 오래된 항목부터 삭제
            if (totalSize > this.maxCacheSize) {
                cacheItems.sort((a, b) => a.timestamp - b.timestamp);
                
                for (const item of cacheItems) {
                    localStorage.removeItem(item.key);
                    totalSize -= item.size;
                    
                    if (totalSize <= this.maxCacheSize * 0.8) break; // 80%까지 줄이기
                }
            }
        } catch (error) {
            console.error('Cache size management failed:', error);
        }
    }

    // 모든 캐시 키 가져오기
    getAllCacheKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.cachePrefix)) {
                keys.push(key);
            }
        }
        return keys;
    }

    // 캐시 통계
    getStats() {
        const cacheKeys = this.getAllCacheKeys();
        let totalSize = 0;
        let itemCount = 0;

        cacheKeys.forEach(key => {
            const cached = localStorage.getItem(key);
            if (cached) {
                const cacheItem = JSON.parse(cached);
                totalSize += cacheItem.size;
                itemCount++;
            }
        });

        return {
            itemCount,
            totalSize,
            maxSize: this.maxCacheSize,
            usage: (totalSize / this.maxCacheSize * 100).toFixed(2)
        };
    }

    // 전체 캐시 삭제
    clear() {
        try {
            const cacheKeys = this.getAllCacheKeys();
            cacheKeys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Cache clear failed:', error);
            return false;
        }
    }

    // 만료된 캐시 정리
    cleanup() {
        try {
            const cacheKeys = this.getAllCacheKeys();
            const now = Date.now();
            let cleanedCount = 0;

            cacheKeys.forEach(key => {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const cacheItem = JSON.parse(cached);
                    if (now - cacheItem.timestamp > cacheItem.expiry) {
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                }
            });

            return cleanedCount;
        } catch (error) {
            console.error('Cache cleanup failed:', error);
            return 0;
        }
    }
}

// 이미지 최적화 유틸리티
class ImageOptimizer {
    constructor() {
        this.maxWidth = 1920;
        this.maxHeight = 1080;
        this.quality = 0.8;
        this.formats = ['image/jpeg', 'image/png', 'image/webp'];
    }

    // 이미지 압축
    async compressImage(file, options = {}) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                try {
                    // 크기 계산
                    const { width, height } = this.calculateDimensions(
                        img.width, 
                        img.height, 
                        options.maxWidth || this.maxWidth,
                        options.maxHeight || this.maxHeight
                    );

                    canvas.width = width;
                    canvas.height = height;

                    // 이미지 그리기
                    ctx.drawImage(img, 0, 0, width, height);

                    // 압축된 이미지 생성
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, {
                                    type: file.type,
                                    lastModified: Date.now()
                                }));
                            } else {
                                reject(new Error('Image compression failed'));
                            }
                        },
                        file.type,
                        options.quality || this.quality
                    );
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Image load failed'));
            img.src = URL.createObjectURL(file);
        });
    }

    // 크기 계산
    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let { width, height } = { width: originalWidth, height: originalHeight };

        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    // 이미지 포맷 변환
    async convertFormat(file, targetFormat = 'image/webp') {
        if (!this.formats.includes(targetFormat)) {
            throw new Error('Unsupported format');
        }

        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, `.${targetFormat.split('/')[1]}`), {
                                type: targetFormat,
                                lastModified: Date.now()
                            }));
                        } else {
                            reject(new Error('Format conversion failed'));
                        }
                    },
                    targetFormat,
                    this.quality
                );
            };

            img.onerror = () => reject(new Error('Image load failed'));
            img.src = URL.createObjectURL(file);
        });
    }

    // 썸네일 생성
    async generateThumbnail(file, size = 150) {
        return this.compressImage(file, {
            maxWidth: size,
            maxHeight: size,
            quality: 0.7
        });
    }
}

// API 요청 배치 처리
class BatchProcessor {
    constructor() {
        this.batchSize = 5;
        this.batchDelay = 100;
        this.requestQueue = [];
        this.processing = false;
    }

    // 요청을 큐에 추가
    addRequest(requestFn, priority = 0) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                requestFn,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            });

            this.requestQueue.sort((a, b) => b.priority - a.priority);
            this.processQueue();
        });
    }

    // 큐 처리
    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;

        this.processing = true;

        while (this.requestQueue.length > 0) {
            const batch = this.requestQueue.splice(0, this.batchSize);
            
            try {
                await Promise.all(
                    batch.map(async (item) => {
                        try {
                            const result = await item.requestFn();
                            item.resolve(result);
                        } catch (error) {
                            item.reject(error);
                        }
                    })
                );
            } catch (error) {
                console.error('Batch processing error:', error);
            }

            if (this.requestQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }

        this.processing = false;
    }

    // 큐 상태
    getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            processing: this.processing
        };
    }
}

// 전역 인스턴스
const cacheManager = new CacheManager();
const imageOptimizer = new ImageOptimizer();
const batchProcessor = new BatchProcessor();

// LZ-String 압축 라이브러리 (간단한 구현)
const LZString = {
    compress: function(input) {
        if (!input) return '';
        // 간단한 압축 시뮬레이션 (실제로는 더 복잡한 알고리즘 사용)
        return btoa(input);
    },
    
    decompress: function(compressed) {
        if (!compressed) return '';
        try {
            return atob(compressed);
        } catch (e) {
            return compressed;
        }
    }
};

