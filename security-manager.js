// 보안 관리자
class SecurityManager {
    constructor() {
        this.validator = new InputValidator();
        this.sanitizer = new DataSanitizer();
        this.errorLogger = new ErrorLogger();
        this.retryManager = new RetryManager();
        this.networkMonitor = new NetworkMonitor();
        this.rateLimiter = new RateLimiter();
        this.init();
    }

    init() {
        this.setupCSP();
        this.setupErrorHandling();
        this.setupNetworkMonitoring();
        this.setupRateLimiting();
    }

    // Content Security Policy 설정
    setupCSP() {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.github.com;";
        document.head.appendChild(meta);
    }

    // 전역 에러 처리 설정
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.errorLogger.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.errorLogger.logError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled Promise Rejection',
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
        });
    }

    // 네트워크 모니터링 설정
    setupNetworkMonitoring() {
        this.networkMonitor.start();
    }

    // 요청 제한 설정
    setupRateLimiting() {
        this.rateLimiter.init();
    }

    // 입력 검증
    validateInput(data, rules) {
        return this.validator.validate(data, rules);
    }

    // 데이터 정제
    sanitizeData(data) {
        return this.sanitizer.sanitize(data);
    }

    // 안전한 API 호출
    async secureApiCall(apiFunction, retryOptions = {}) {
        // 요청 제한 확인
        if (!this.rateLimiter.canMakeRequest()) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }

        // 재시도 메커니즘과 함께 API 호출
        return this.retryManager.executeWithRetry(apiFunction, retryOptions);
    }

    // 파일 업로드 보안 검사
    validateFileUpload(file) {
        const validation = {
            isValid: true,
            errors: []
        };

        // 파일 크기 검사
        if (file.size > 25 * 1024 * 1024) {
            validation.isValid = false;
            validation.errors.push('파일 크기가 25MB를 초과합니다.');
        }

        // 파일 타입 검사
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            validation.isValid = false;
            validation.errors.push('지원하지 않는 파일 형식입니다.');
        }

        // 파일 이름 검사
        if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
            validation.isValid = false;
            validation.errors.push('파일 이름에 특수문자가 포함되어 있습니다.');
        }

        // 파일 확장자 이중 검사
        const extension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!allowedExtensions.includes(extension)) {
            validation.isValid = false;
            validation.errors.push('허용되지 않는 파일 확장자입니다.');
        }

        return validation;
    }

    // 보안 헤더 검사
    checkSecurityHeaders() {
        const headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };

        return headers;
    }
}

// 입력 검증기
class InputValidator {
    constructor() {
        this.rules = {
            required: (value) => value !== null && value !== undefined && value !== '',
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            alphanumeric: (value) => /^[a-zA-Z0-9]+$/.test(value),
            noSpecialChars: (value) => /^[a-zA-Z0-9\s가-힣]+$/.test(value),
            date: (value) => !isNaN(Date.parse(value)),
            number: (value) => !isNaN(Number(value)),
            url: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            }
        };
    }

    validate(data, rules) {
        const errors = {};
        let isValid = true;

        for (const field in rules) {
            const fieldRules = rules[field];
            const value = data[field];
            const fieldErrors = [];

            for (const rule of fieldRules) {
                if (typeof rule === 'string') {
                    if (!this.rules[rule](value)) {
                        fieldErrors.push(`${field}이(가) ${rule} 규칙을 위반했습니다.`);
                    }
                } else if (typeof rule === 'object') {
                    const { type, param, message } = rule;
                    if (!this.rules[type](value, param)) {
                        fieldErrors.push(message || `${field}이(가) ${type} 규칙을 위반했습니다.`);
                    }
                }
            }

            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
                isValid = false;
            }
        }

        return { isValid, errors };
    }

    // 커스텀 규칙 추가
    addRule(name, validator) {
        this.rules[name] = validator;
    }
}

// 데이터 정제기
class DataSanitizer {
    constructor() {
        this.htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
    }

    // HTML 이스케이프
    escapeHtml(text) {
        return String(text).replace(/[&<>"'\/]/g, (s) => this.htmlEntities[s]);
    }

    // SQL 인젝션 방지 (클라이언트 사이드)
    escapeSql(text) {
        return String(text).replace(/'/g, "''");
    }

    // 스크립트 태그 제거
    removeScripts(text) {
        return String(text).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    // 위험한 속성 제거
    removeDangerousAttributes(html) {
        const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
        let cleaned = html;
        
        dangerousAttrs.forEach(attr => {
            const regex = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        return cleaned;
    }

    // 종합 정제
    sanitize(data) {
        if (typeof data === 'string') {
            return this.removeDangerousAttributes(
                this.removeScripts(
                    this.escapeHtml(data)
                )
            );
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const key in data) {
                sanitized[key] = this.sanitize(data[key]);
            }
            return sanitized;
        }
        
        return data;
    }

    // URL 정제
    sanitizeUrl(url) {
        // 위험한 프로토콜 제거
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
        const urlLower = url.toLowerCase();
        
        for (const protocol of dangerousProtocols) {
            if (urlLower.startsWith(protocol)) {
                return '#';
            }
        }
        
        return url;
    }
}

// 에러 로거
class ErrorLogger {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.reportingEndpoint = null; // 실제 환경에서는 에러 리포팅 서비스 URL
    }

    logError(error) {
        const errorEntry = {
            id: this.generateId(),
            ...error,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        this.errors.push(errorEntry);
        
        // 최대 에러 수 제한
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // 로컬 스토리지에 저장
        this.saveToStorage();
        
        // 콘솔에 출력
        console.error('Error logged:', errorEntry);
        
        // 외부 서비스로 전송 (옵션)
        if (this.reportingEndpoint) {
            this.reportError(errorEntry);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    saveToStorage() {
        try {
            localStorage.setItem('errorLogs', JSON.stringify(this.errors));
        } catch (e) {
            console.warn('Failed to save error logs to localStorage:', e);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('errorLogs');
            if (stored) {
                this.errors = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load error logs from localStorage:', e);
        }
    }

    async reportError(error) {
        if (!this.reportingEndpoint) return;
        
        try {
            await fetch(this.reportingEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(error)
            });
        } catch (e) {
            console.warn('Failed to report error:', e);
        }
    }

    getErrors(filter = {}) {
        let filtered = this.errors;
        
        if (filter.type) {
            filtered = filtered.filter(error => error.type === filter.type);
        }
        
        if (filter.since) {
            const since = new Date(filter.since);
            filtered = filtered.filter(error => new Date(error.timestamp) >= since);
        }
        
        return filtered;
    }

    clearErrors() {
        this.errors = [];
        this.saveToStorage();
    }
}

// 재시도 관리자
class RetryManager {
    constructor() {
        this.defaultOptions = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2,
            retryCondition: (error) => {
                // 네트워크 에러나 5xx 에러만 재시도
                return error.name === 'NetworkError' || 
                       (error.status >= 500 && error.status < 600) ||
                       error.message.includes('rate limit');
            }
        };
    }

    async executeWithRetry(fn, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        let lastError;
        
        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
            try {
                const result = await fn();
                return result;
            } catch (error) {
                lastError = error;
                
                // 재시도 조건 확인
                if (!opts.retryCondition(error) || attempt === opts.maxRetries) {
                    throw error;
                }
                
                // 지연 시간 계산
                const delay = Math.min(
                    opts.baseDelay * Math.pow(opts.backoffFactor, attempt),
                    opts.maxDelay
                );
                
                console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
                
                // 지연
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
}

// 네트워크 모니터
class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.connectionType = this.getConnectionType();
        this.listeners = [];
    }

    start() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline');
        });
        
        // 연결 타입 모니터링
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this.connectionType = this.getConnectionType();
                this.notifyListeners('connectionchange');
            });
        }
    }

    getConnectionType() {
        if ('connection' in navigator) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return null;
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event, {
                    isOnline: this.isOnline,
                    connectionType: this.connectionType
                });
            } catch (error) {
                console.error('Network listener error:', error);
            }
        });
    }

    getStatus() {
        return {
            isOnline: this.isOnline,
            connectionType: this.connectionType
        };
    }
}

// 요청 제한기
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.limits = {
            api: { count: 60, window: 60000 }, // 1분에 60회
            upload: { count: 10, window: 60000 }, // 1분에 10회
            search: { count: 30, window: 60000 } // 1분에 30회
        };
    }

    init() {
        // 주기적으로 오래된 요청 기록 정리
        setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    canMakeRequest(type = 'api') {
        const limit = this.limits[type];
        if (!limit) return true;

        const now = Date.now();
        const key = `${type}_${Math.floor(now / limit.window)}`;
        
        const current = this.requests.get(key) || 0;
        
        if (current >= limit.count) {
            return false;
        }
        
        this.requests.set(key, current + 1);
        return true;
    }

    getRemainingRequests(type = 'api') {
        const limit = this.limits[type];
        if (!limit) return Infinity;

        const now = Date.now();
        const key = `${type}_${Math.floor(now / limit.window)}`;
        const current = this.requests.get(key) || 0;
        
        return Math.max(0, limit.count - current);
    }

    getResetTime(type = 'api') {
        const limit = this.limits[type];
        if (!limit) return null;

        const now = Date.now();
        const windowStart = Math.floor(now / limit.window) * limit.window;
        return new Date(windowStart + limit.window);
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        this.requests.forEach((value, key) => {
            const [type, window] = key.split('_');
            const limit = this.limits[type];
            
            if (limit && now - (parseInt(window) * limit.window) > limit.window) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => this.requests.delete(key));
    }
}

// 전역 인스턴스
const securityManager = new SecurityManager();

// 전역 에러 핸들러 등록
window.securityManager = securityManager;

