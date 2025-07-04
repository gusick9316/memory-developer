class APIOptimizer {
    constructor() {
        this.requestQueue = [];
        this.isProcessing = false;
        this.rateLimitInfo = {
            remaining: 5000,
            reset: Date.now() + 3600000, // 1시간 후
            limit: 5000
        };
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.retryDelays = [1000, 2000, 4000, 8000]; // 지수 백오프
    }

    // 요청 큐에 추가
    async queueRequest(requestFn, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const request = {
                fn: requestFn,
                priority,
                resolve,
                reject,
                timestamp: Date.now(),
                retries: 0
            };

            // 우선순위에 따라 큐에 삽입
            if (priority === 'high') {
                this.requestQueue.unshift(request);
            } else {
                this.requestQueue.push(request);
            }

            this.processQueue();
        });
    }

    // 요청 큐 처리
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            // 레이트 리미트 확인
            if (this.rateLimitInfo.remaining <= 10) {
                const waitTime = this.rateLimitInfo.reset - Date.now();
                if (waitTime > 0) {
                    console.log(`Rate limit reached, waiting ${waitTime}ms`);
                    await this.delay(waitTime);
                }
            }

            const request = this.requestQueue.shift();
            await this.executeRequest(request);
        }

        this.isProcessing = false;
    }

    // 개별 요청 실행
    async executeRequest(request) {
        try {
            const result = await request.fn();
            request.resolve(result);
        } catch (error) {
            if (this.shouldRetry(error, request)) {
                await this.retryRequest(request);
            } else {
                request.reject(error);
            }
        }
    }

    // 재시도 여부 판단
    shouldRetry(error, request) {
        const retryableErrors = [429, 500, 502, 503, 504];
        const statusCode = error.message.match(/HTTP (\d+)/)?.[1];
        
        return (
            request.retries < this.retryDelays.length &&
            (retryableErrors.includes(parseInt(statusCode)) || 
             error.message.includes('network') ||
             error.message.includes('timeout'))
        );
    }

    // 요청 재시도
    async retryRequest(request) {
        const delay = this.retryDelays[request.retries];
        request.retries++;
        
        console.log(`Retrying request (attempt ${request.retries}/${this.retryDelays.length}) after ${delay}ms`);
        
        await this.delay(delay);
        
        // 우선순위를 높여서 큐 앞쪽에 추가
        this.requestQueue.unshift(request);
    }

    // 중복 요청 방지
    async deduplicateRequest(key, requestFn) {
        // 이미 진행 중인 요청이 있으면 그 결과를 기다림
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        // 캐시된 결과가 있으면 반환
        if (this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < 300000) { // 5분 캐시
                return cached.data;
            }
            this.cache.delete(key);
        }

        // 새 요청 실행
        const promise = this.queueRequest(requestFn);
        this.pendingRequests.set(key, promise);

        try {
            const result = await promise;
            
            // 결과 캐싱
            this.cache.set(key, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    // 배치 요청 처리
    async batchRequests(requests, batchSize = 3) {
        const results = [];
        
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(request => 
                this.queueRequest(request.fn, request.priority || 'normal')
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);
            
            // 배치 간 짧은 지연
            if (i + batchSize < requests.length) {
                await this.delay(100);
            }
        }
        
        return results;
    }

    // 레이트 리미트 정보 업데이트
    updateRateLimit(headers) {
        if (headers['x-ratelimit-remaining']) {
            this.rateLimitInfo.remaining = parseInt(headers['x-ratelimit-remaining']);
        }
        if (headers['x-ratelimit-reset']) {
            this.rateLimitInfo.reset = parseInt(headers['x-ratelimit-reset']) * 1000;
        }
        if (headers['x-ratelimit-limit']) {
            this.rateLimitInfo.limit = parseInt(headers['x-ratelimit-limit']);
        }
    }

    // 지연 함수
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 캐시 정리
    clearCache() {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    // 통계 정보
    getStats() {
        return {
            queueLength: this.requestQueue.length,
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            rateLimitRemaining: this.rateLimitInfo.remaining,
            isProcessing: this.isProcessing
        };
    }

    // 우선순위 요청 (즉시 실행이 필요한 경우)
    async priorityRequest(requestFn) {
        return this.queueRequest(requestFn, 'high');
    }

    // 백그라운드 요청 (낮은 우선순위)
    async backgroundRequest(requestFn) {
        return this.queueRequest(requestFn, 'low');
    }
}

// GitHub API 최적화 확장
class OptimizedGitHubAPI extends GitHubAPI {
    constructor() {
        super();
        this.apiOptimizer = new APIOptimizer();
        this.dataCache = new Map();
    }

    // 최적화된 요청 메서드
    async makeOptimizedRequest(url, options = {}, cacheKey = null) {
        const requestFn = async () => {
            const response = await super.makeRequest(url, options);
            
            // 레이트 리미트 정보 업데이트
            if (response.headers) {
                this.apiOptimizer.updateRateLimit(response.headers);
            }
            
            return response;
        };

        if (cacheKey) {
            return this.apiOptimizer.deduplicateRequest(cacheKey, requestFn);
        } else {
            return this.apiOptimizer.queueRequest(requestFn);
        }
    }

    // 최적화된 폴더 내용 조회
    async listFolderContents(folderPath) {
        const cacheKey = `folder:${folderPath}`;
        return this.makeOptimizedRequest(
            `${this.baseUrl}/contents/${folderPath}`,
            {},
            cacheKey
        );
    }

    // 최적화된 파일 내용 조회
    async getFileContent(path) {
        const cacheKey = `file:${path}`;
        return this.makeOptimizedRequest(
            `${this.baseUrl}/contents/${path}`,
            {},
            cacheKey
        );
    }

    // 배치 파일 업로드
    async batchUpload(files) {
        const requests = files.map(file => ({
            fn: () => this.uploadImage(file.path, file.data, file.message),
            priority: 'normal'
        }));

        return this.apiOptimizer.batchRequests(requests);
    }

    // 캐시 무효화
    invalidateCache(pattern) {
        for (const key of this.apiOptimizer.cache.keys()) {
            if (key.includes(pattern)) {
                this.apiOptimizer.cache.delete(key);
            }
        }
    }

    // 통계 정보
    getOptimizationStats() {
        return this.apiOptimizer.getStats();
    }
}

// 전역 최적화된 GitHub API 인스턴스로 교체
window.githubAPI = new OptimizedGitHubAPI();
window.apiOptimizer = window.githubAPI.apiOptimizer;

