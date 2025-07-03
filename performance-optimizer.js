// 성능 최적화 모듈
class PerformanceOptimizer {
    constructor() {
        this.observers = new Map();
        this.rafId = null;
        this.performanceMetrics = {
            renderTime: [],
            memoryUsage: [],
            apiResponseTime: []
        };
    }

    // 가상 스크롤링 구현
    createVirtualScroller(container, items, renderItem, itemHeight = 100) {
        const virtualScroller = new VirtualScroller(container, items, renderItem, itemHeight);
        return virtualScroller;
    }

    // 디바운스 함수
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 스로틀 함수
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 메모리 사용량 모니터링
    monitorMemoryUsage() {
        if (performance.memory) {
            const memoryInfo = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
            
            this.performanceMetrics.memoryUsage.push(memoryInfo);
            
            // 최근 100개 항목만 유지
            if (this.performanceMetrics.memoryUsage.length > 100) {
                this.performanceMetrics.memoryUsage.shift();
            }
            
            return memoryInfo;
        }
        return null;
    }

    // 렌더링 성능 측정
    measureRenderTime(renderFunction) {
        const startTime = performance.now();
        
        return new Promise((resolve) => {
            renderFunction();
            
            requestAnimationFrame(() => {
                const endTime = performance.now();
                const renderTime = endTime - startTime;
                
                this.performanceMetrics.renderTime.push({
                    duration: renderTime,
                    timestamp: Date.now()
                });
                
                if (this.performanceMetrics.renderTime.length > 100) {
                    this.performanceMetrics.renderTime.shift();
                }
                
                resolve(renderTime);
            });
        });
    }

    // API 응답 시간 측정
    measureApiResponseTime(apiCall) {
        const startTime = performance.now();
        
        return apiCall().then(result => {
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            this.performanceMetrics.apiResponseTime.push({
                duration: responseTime,
                timestamp: Date.now()
            });
            
            if (this.performanceMetrics.apiResponseTime.length > 100) {
                this.performanceMetrics.apiResponseTime.shift();
            }
            
            return { result, responseTime };
        });
    }

    // 성능 통계 가져오기
    getPerformanceStats() {
        const calculateStats = (metrics) => {
            if (metrics.length === 0) return { avg: 0, min: 0, max: 0 };
            
            const durations = metrics.map(m => m.duration);
            return {
                avg: durations.reduce((a, b) => a + b, 0) / durations.length,
                min: Math.min(...durations),
                max: Math.max(...durations),
                count: durations.length
            };
        };

        return {
            renderTime: calculateStats(this.performanceMetrics.renderTime),
            apiResponseTime: calculateStats(this.performanceMetrics.apiResponseTime),
            memoryUsage: this.getMemoryStats()
        };
    }

    // 메모리 통계
    getMemoryStats() {
        if (this.performanceMetrics.memoryUsage.length === 0) {
            return { current: 0, peak: 0, average: 0 };
        }

        const current = this.performanceMetrics.memoryUsage[this.performanceMetrics.memoryUsage.length - 1];
        const peak = Math.max(...this.performanceMetrics.memoryUsage.map(m => m.used));
        const average = this.performanceMetrics.memoryUsage.reduce((a, b) => a + b.used, 0) / this.performanceMetrics.memoryUsage.length;

        return {
            current: current.used,
            peak,
            average,
            limit: current.limit
        };
    }

    // 메모리 정리
    cleanupMemory() {
        // 사용하지 않는 객체 참조 제거
        if (window.gc) {
            window.gc();
        }
        
        // 캐시 정리
        cacheManager.cleanup();
        
        // 이벤트 리스너 정리
        this.cleanupEventListeners();
    }

    // 이벤트 리스너 정리
    cleanupEventListeners() {
        this.observers.forEach((observer, element) => {
            if (observer.disconnect) {
                observer.disconnect();
            }
        });
        this.observers.clear();
    }
}

// 가상 스크롤러 클래스
class VirtualScroller {
    constructor(container, items, renderItem, itemHeight = 100) {
        this.container = container;
        this.items = items;
        this.renderItem = renderItem;
        this.itemHeight = itemHeight;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.init();
    }

    init() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        // 스크롤 이벤트 리스너
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        
        // 리사이즈 이벤트 리스너
        window.addEventListener('resize', this.handleResize.bind(this));
        
        this.update();
    }

    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.update();
    }

    handleResize() {
        this.containerHeight = this.container.clientHeight;
        this.update();
    }

    update() {
        this.containerHeight = this.container.clientHeight;
        const totalHeight = this.items.length * this.itemHeight;
        
        // 보이는 영역 계산
        this.visibleStart = Math.floor(this.scrollTop / this.itemHeight);
        this.visibleEnd = Math.min(
            this.visibleStart + Math.ceil(this.containerHeight / this.itemHeight) + 1,
            this.items.length
        );
        
        // 버퍼 추가 (부드러운 스크롤을 위해)
        const buffer = 5;
        this.visibleStart = Math.max(0, this.visibleStart - buffer);
        this.visibleEnd = Math.min(this.items.length, this.visibleEnd + buffer);
        
        this.render(totalHeight);
    }

    render(totalHeight) {
        // 컨테이너 높이 설정
        this.container.style.height = `${totalHeight}px`;
        
        // 기존 아이템 제거
        this.container.innerHTML = '';
        
        // 보이는 아이템만 렌더링
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const item = this.items[i];
            const element = this.renderItem(item, i);
            
            element.style.position = 'absolute';
            element.style.top = `${i * this.itemHeight}px`;
            element.style.height = `${this.itemHeight}px`;
            element.style.width = '100%';
            
            this.container.appendChild(element);
        }
    }

    // 아이템 업데이트
    updateItems(newItems) {
        this.items = newItems;
        this.update();
    }

    // 특정 인덱스로 스크롤
    scrollToIndex(index) {
        const targetScrollTop = index * this.itemHeight;
        this.container.scrollTop = targetScrollTop;
    }

    // 정리
    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
    }
}

// 지연 로딩 관리자
class LazyLoadManager {
    constructor() {
        this.observer = null;
        this.loadedElements = new Set();
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                this.handleIntersection.bind(this),
                {
                    rootMargin: '50px',
                    threshold: 0.1
                }
            );
        }
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
                this.loadElement(entry.target);
                this.loadedElements.add(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    }

    loadElement(element) {
        if (element.dataset.src) {
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
        }
        
        if (element.dataset.load) {
            const loadFunction = window[element.dataset.load];
            if (typeof loadFunction === 'function') {
                loadFunction(element);
            }
        }
    }

    observe(element) {
        if (this.observer) {
            this.observer.observe(element);
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadElement(element);
        }
    }

    unobserve(element) {
        if (this.observer) {
            this.observer.unobserve(element);
        }
        this.loadedElements.delete(element);
    }

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.loadedElements.clear();
    }
}

// 리소스 프리로더
class ResourcePreloader {
    constructor() {
        this.preloadedResources = new Map();
        this.preloadQueue = [];
        this.maxConcurrent = 3;
        this.currentLoading = 0;
    }

    // 이미지 프리로드
    preloadImage(url, priority = 0) {
        return new Promise((resolve, reject) => {
            if (this.preloadedResources.has(url)) {
                resolve(this.preloadedResources.get(url));
                return;
            }

            this.preloadQueue.push({
                url,
                priority,
                type: 'image',
                resolve,
                reject
            });

            this.preloadQueue.sort((a, b) => b.priority - a.priority);
            this.processQueue();
        });
    }

    // 큐 처리
    async processQueue() {
        while (this.preloadQueue.length > 0 && this.currentLoading < this.maxConcurrent) {
            const item = this.preloadQueue.shift();
            this.currentLoading++;
            
            try {
                const resource = await this.loadResource(item);
                this.preloadedResources.set(item.url, resource);
                item.resolve(resource);
            } catch (error) {
                item.reject(error);
            } finally {
                this.currentLoading--;
                this.processQueue();
            }
        }
    }

    // 리소스 로드
    loadResource(item) {
        return new Promise((resolve, reject) => {
            if (item.type === 'image') {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = item.url;
            }
        });
    }

    // 프리로드된 리소스 가져오기
    getPreloadedResource(url) {
        return this.preloadedResources.get(url);
    }

    // 캐시 정리
    clearCache() {
        this.preloadedResources.clear();
    }
}

// 전역 인스턴스
const performanceOptimizer = new PerformanceOptimizer();
const lazyLoadManager = new LazyLoadManager();
const resourcePreloader = new ResourcePreloader();

// 성능 모니터링 시작
setInterval(() => {
    performanceOptimizer.monitorMemoryUsage();
}, 5000);

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    performanceOptimizer.cleanupMemory();
    lazyLoadManager.disconnect();
    resourcePreloader.clearCache();
});

