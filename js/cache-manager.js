class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.storageCache = this.initStorageCache();
        this.cacheConfig = {
            maxMemorySize: 50, // 최대 50개 항목
            maxStorageSize: 100, // 최대 100개 항목
            defaultTTL: 300000, // 5분
            imageTTL: 1800000, // 30분
            dataTTL: 600000 // 10분
        };
    }

    // 로컬 스토리지 캐시 초기화
    initStorageCache() {
        try {
            const cached = localStorage.getItem('app_cache');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.warn('Failed to load cache from localStorage:', error);
            return {};
        }
    }

    // 캐시에 데이터 저장
    set(key, data, ttl = null) {
        const now = Date.now();
        const expiry = now + (ttl || this.cacheConfig.defaultTTL);
        
        const cacheItem = {
            data,
            timestamp: now,
            expiry,
            size: this.calculateSize(data)
        };

        // 메모리 캐시에 저장
        this.memoryCache.set(key, cacheItem);

        // 메모리 캐시 크기 관리
        this.cleanupMemoryCache();

        // 중요한 데이터는 로컬 스토리지에도 저장
        if (this.shouldPersist(key)) {
            this.storageCache[key] = cacheItem;
            this.saveStorageCache();
        }
    }

    // 캐시에서 데이터 조회
    get(key) {
        // 메모리 캐시 우선 확인
        let item = this.memoryCache.get(key);
        
        // 메모리에 없으면 스토리지 캐시 확인
        if (!item && this.storageCache[key]) {
            item = this.storageCache[key];
            // 메모리 캐시에 복원
            this.memoryCache.set(key, item);
        }

        if (!item) return null;

        // 만료 확인
        if (Date.now() > item.expiry) {
            this.delete(key);
            return null;
        }

        return item.data;
    }

    // 캐시에서 데이터 삭제
    delete(key) {
        this.memoryCache.delete(key);
        delete this.storageCache[key];
        this.saveStorageCache();
    }

    // 패턴으로 캐시 삭제
    deleteByPattern(pattern) {
        const regex = new RegExp(pattern);
        
        // 메모리 캐시 정리
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
            }
        }

        // 스토리지 캐시 정리
        for (const key in this.storageCache) {
            if (regex.test(key)) {
                delete this.storageCache[key];
            }
        }
        
        this.saveStorageCache();
    }

    // 데이터 크기 계산
    calculateSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 1000; // 기본값
        }
    }

    // 지속 저장 여부 판단
    shouldPersist(key) {
        const persistPatterns = ['memories:', 'students:', 'developers:', 'auth:'];
        return persistPatterns.some(pattern => key.startsWith(pattern));
    }

    // 메모리 캐시 정리
    cleanupMemoryCache() {
        if (this.memoryCache.size <= this.cacheConfig.maxMemorySize) return;

        // LRU 방식으로 정리 (가장 오래된 항목부터 삭제)
        const entries = Array.from(this.memoryCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        const deleteCount = this.memoryCache.size - this.cacheConfig.maxMemorySize;
        for (let i = 0; i < deleteCount; i++) {
            this.memoryCache.delete(entries[i][0]);
        }
    }

    // 스토리지 캐시 저장
    saveStorageCache() {
        try {
            // 크기 제한 확인
            const entries = Object.entries(this.storageCache);
            if (entries.length > this.cacheConfig.maxStorageSize) {
                // 오래된 항목부터 삭제
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const deleteCount = entries.length - this.cacheConfig.maxStorageSize;
                
                for (let i = 0; i < deleteCount; i++) {
                    delete this.storageCache[entries[i][0]];
                }
            }

            localStorage.setItem('app_cache', JSON.stringify(this.storageCache));
        } catch (error) {
            console.warn('Failed to save cache to localStorage:', error);
        }
    }

    // 캐시 통계
    getStats() {
        const memorySize = this.memoryCache.size;
        const storageSize = Object.keys(this.storageCache).length;
        
        return {
            memorySize,
            storageSize,
            memoryLimit: this.cacheConfig.maxMemorySize,
            storageLimit: this.cacheConfig.maxStorageSize
        };
    }

    // 전체 캐시 정리
    clear() {
        this.memoryCache.clear();
        this.storageCache = {};
        localStorage.removeItem('app_cache');
    }
}

class LoadingStateManager {
    constructor() {
        this.loadingStates = new Map();
        this.loadingElements = new Map();
        this.globalLoadingCount = 0;
    }

    // 로딩 상태 시작
    startLoading(key, element = null, options = {}) {
        const config = {
            showSpinner: true,
            showProgress: false,
            message: '로딩 중...',
            ...options
        };

        this.loadingStates.set(key, {
            startTime: Date.now(),
            config
        });

        if (element) {
            this.loadingElements.set(key, element);
            this.applyLoadingStyle(element, config);
        }

        this.globalLoadingCount++;
        this.updateGlobalLoadingState();

        // 자동 정리 (30초 후)
        setTimeout(() => {
            if (this.loadingStates.has(key)) {
                this.stopLoading(key);
            }
        }, 30000);

        return () => this.stopLoading(key);
    }

    // 로딩 상태 종료
    stopLoading(key) {
        if (!this.loadingStates.has(key)) return;

        const element = this.loadingElements.get(key);
        if (element) {
            this.removeLoadingStyle(element);
            this.loadingElements.delete(key);
        }

        this.loadingStates.delete(key);
        this.globalLoadingCount = Math.max(0, this.globalLoadingCount - 1);
        this.updateGlobalLoadingState();
    }

    // 로딩 스타일 적용
    applyLoadingStyle(element, config) {
        element.classList.add('loading-state');
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.7';

        if (config.showSpinner) {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner-overlay';
            spinner.innerHTML = `
                <div class="spinner">
                    <div class="spinner-circle"></div>
                </div>
                ${config.message ? `<div class="loading-message">${config.message}</div>` : ''}
            `;
            element.appendChild(spinner);
        }
    }

    // 로딩 스타일 제거
    removeLoadingStyle(element) {
        element.classList.remove('loading-state');
        element.style.pointerEvents = '';
        element.style.opacity = '';

        const spinner = element.querySelector('.loading-spinner-overlay');
        if (spinner) {
            spinner.remove();
        }
    }

    // 전역 로딩 상태 업데이트
    updateGlobalLoadingState() {
        const body = document.body;
        if (this.globalLoadingCount > 0) {
            body.classList.add('app-loading');
        } else {
            body.classList.remove('app-loading');
        }
    }

    // 진행률 업데이트
    updateProgress(key, progress, message = null) {
        const element = this.loadingElements.get(key);
        if (!element) return;

        let progressBar = element.querySelector('.progress-bar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = `
                <div class="progress-fill"></div>
                <div class="progress-text"></div>
            `;
            element.appendChild(progressBar);
        }

        const fill = progressBar.querySelector('.progress-fill');
        const text = progressBar.querySelector('.progress-text');
        
        fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        if (message) {
            text.textContent = message;
        }
    }

    // 로딩 상태 확인
    isLoading(key) {
        return this.loadingStates.has(key);
    }

    // 모든 로딩 상태 정리
    clearAll() {
        for (const key of this.loadingStates.keys()) {
            this.stopLoading(key);
        }
    }

    // 통계 정보
    getStats() {
        return {
            activeLoadings: this.loadingStates.size,
            globalLoadingCount: this.globalLoadingCount,
            loadingKeys: Array.from(this.loadingStates.keys())
        };
    }
}

// 전역 인스턴스
window.cacheManager = new CacheManager();
window.loadingStateManager = new LoadingStateManager();

