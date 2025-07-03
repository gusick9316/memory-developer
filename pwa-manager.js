// PWA 관리자
class PWAManager {
    constructor() {
        this.swRegistration = null;
        this.deferredPrompt = null;
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.syncManager = new SyncManager();
        this.installPromptShown = localStorage.getItem('installPromptShown') === 'true';
        this.init();
    }

    async init() {
        await this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupOfflineHandling();
        this.setupBackgroundSync();
        this.setupPeriodicSync();
        this.createPWAInterface();
    }

    // Service Worker 등록
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                console.log('Service Worker registered successfully:', this.swRegistration);

                // 업데이트 확인
                this.swRegistration.addEventListener('updatefound', () => {
                    const newWorker = this.swRegistration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });

                // 메시지 리스너
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event);
                });

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    // 앱 설치 프롬프트 설정
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            if (!this.installPromptShown) {
                this.showInstallPrompt();
            }
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.deferredPrompt = null;
            this.hideInstallPrompt();
            
            // 설치 완료 알림
            if (utilityFeatures?.notificationManager) {
                utilityFeatures.notificationManager.addNotification(
                    '앱 설치 완료',
                    '추억 저장소가 성공적으로 설치되었습니다!',
                    'success'
                );
            }
        });
    }

    // 오프라인 처리 설정
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // 초기 상태 확인
        if (!this.isOnline) {
            this.handleOffline();
        }
    }

    // 백그라운드 동기화 설정
    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            // 백그라운드 동기화 등록
            this.registerBackgroundSync();
        }
    }

    // 주기적 동기화 설정
    async setupPeriodicSync() {
        if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
            try {
                const status = await navigator.permissions.query({
                    name: 'periodic-background-sync'
                });

                if (status.state === 'granted') {
                    await this.swRegistration.periodicSync.register('content-sync', {
                        minInterval: 24 * 60 * 60 * 1000 // 24시간
                    });
                    console.log('Periodic sync registered');
                }
            } catch (error) {
                console.log('Periodic sync not supported or failed:', error);
            }
        }
    }

    // PWA 인터페이스 생성
    createPWAInterface() {
        // 설치 프롬프트 UI
        const installPrompt = document.createElement('div');
        installPrompt.id = 'installPrompt';
        installPrompt.className = 'install-prompt hidden';
        installPrompt.innerHTML = `
            <div class="install-prompt-content">
                <div class="install-prompt-icon">📱</div>
                <div class="install-prompt-text">
                    <h3>앱으로 설치하기</h3>
                    <p>홈 화면에 추가하여 더 빠르고 편리하게 이용하세요!</p>
                </div>
                <div class="install-prompt-actions">
                    <button onclick="pwaManager.installApp()">설치</button>
                    <button onclick="pwaManager.dismissInstallPrompt()">나중에</button>
                </div>
            </div>
        `;

        // 오프라인 표시기
        const offlineIndicator = document.createElement('div');
        offlineIndicator.id = 'offlineIndicator';
        offlineIndicator.className = 'offline-indicator hidden';
        offlineIndicator.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi-slash"></i>
                <span>오프라인 모드</span>
                <button onclick="pwaManager.retryConnection()">재연결</button>
            </div>
        `;

        // 업데이트 알림
        const updateNotification = document.createElement('div');
        updateNotification.id = 'updateNotification';
        updateNotification.className = 'update-notification hidden';
        updateNotification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-download"></i>
                <span>새 버전이 사용 가능합니다</span>
                <button onclick="pwaManager.updateApp()">업데이트</button>
                <button onclick="pwaManager.dismissUpdate()">나중에</button>
            </div>
        `;

        // DOM에 추가
        document.body.appendChild(installPrompt);
        document.body.appendChild(offlineIndicator);
        document.body.appendChild(updateNotification);
    }

    // 설치 프롬프트 표시
    showInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt && this.deferredPrompt) {
            prompt.classList.remove('hidden');
        }
    }

    // 설치 프롬프트 숨기기
    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.add('hidden');
        }
    }

    // 앱 설치
    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallPrompt();
        }
    }

    // 설치 프롬프트 무시
    dismissInstallPrompt() {
        this.hideInstallPrompt();
        this.installPromptShown = true;
        localStorage.setItem('installPromptShown', 'true');
    }

    // 온라인 상태 처리
    handleOnline() {
        console.log('App is online');
        
        // 오프라인 표시기 숨기기
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }

        // 대기 중인 요청 처리
        this.processOfflineQueue();

        // 백그라운드 동기화 트리거
        this.triggerBackgroundSync();

        // 알림
        if (utilityFeatures?.notificationManager) {
            utilityFeatures.notificationManager.addNotification(
                '연결 복구됨',
                '인터넷 연결이 복구되었습니다.',
                'success'
            );
        }
    }

    // 오프라인 상태 처리
    handleOffline() {
        console.log('App is offline');
        
        // 오프라인 표시기 표시
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }

        // 알림
        if (utilityFeatures?.notificationManager) {
            utilityFeatures.notificationManager.addNotification(
                '오프라인 모드',
                '인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.',
                'warning',
                true
            );
        }
    }

    // 연결 재시도
    async retryConnection() {
        try {
            const response = await fetch('/', { method: 'HEAD' });
            if (response.ok) {
                this.isOnline = true;
                this.handleOnline();
            }
        } catch (error) {
            console.log('Connection retry failed');
        }
    }

    // 오프라인 큐에 요청 추가
    addToOfflineQueue(request) {
        this.offlineQueue.push({
            id: Date.now().toString(),
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: request.body,
            timestamp: new Date().toISOString()
        });

        // IndexedDB에 저장
        this.saveOfflineRequest(this.offlineQueue[this.offlineQueue.length - 1]);
    }

    // 오프라인 요청 저장
    async saveOfflineRequest(request) {
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('MemoryStorageDB', 1);
            
            dbRequest.onerror = () => reject(dbRequest.error);
            
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const transaction = db.transaction(['pendingSync'], 'readwrite');
                const store = transaction.objectStore('pendingSync');
                
                const addRequest = store.add(request);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            };
            
            dbRequest.onupgradeneeded = () => {
                const db = dbRequest.result;
                if (!db.objectStoreNames.contains('pendingSync')) {
                    db.createObjectStore('pendingSync', { keyPath: 'id' });
                }
            };
        });
    }

    // 오프라인 큐 처리
    async processOfflineQueue() {
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const request of queue) {
            try {
                await fetch(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body
                });
                
                console.log('Offline request processed:', request.url);
            } catch (error) {
                console.error('Failed to process offline request:', error);
                // 실패한 요청은 다시 큐에 추가
                this.offlineQueue.push(request);
            }
        }
    }

    // 백그라운드 동기화 등록
    async registerBackgroundSync() {
        if (this.swRegistration) {
            try {
                await this.swRegistration.sync.register('background-sync');
                console.log('Background sync registered');
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
    }

    // 백그라운드 동기화 트리거
    triggerBackgroundSync() {
        if (this.swRegistration && 'sync' in this.swRegistration) {
            this.swRegistration.sync.register('background-sync');
        }
    }

    // Service Worker 메시지 처리
    handleServiceWorkerMessage(event) {
        const { data } = event;
        
        switch (data.type) {
            case 'SYNC_COMPLETE':
                console.log('Background sync completed');
                if (utilityFeatures?.notificationManager) {
                    utilityFeatures.notificationManager.addNotification(
                        '동기화 완료',
                        '오프라인 중 저장된 데이터가 동기화되었습니다.',
                        'success'
                    );
                }
                break;
                
            case 'CACHE_UPDATED':
                console.log('Cache updated');
                break;
                
            default:
                console.log('Unknown message from service worker:', data);
        }
    }

    // 업데이트 사용 가능 알림
    showUpdateAvailable() {
        const notification = document.getElementById('updateNotification');
        if (notification) {
            notification.classList.remove('hidden');
        }
    }

    // 앱 업데이트
    updateApp() {
        if (this.swRegistration && this.swRegistration.waiting) {
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // 페이지 새로고침
            window.location.reload();
        }
    }

    // 업데이트 알림 무시
    dismissUpdate() {
        const notification = document.getElementById('updateNotification');
        if (notification) {
            notification.classList.add('hidden');
        }
    }

    // PWA 상태 확인
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    // 설치 가능 여부 확인
    canInstall() {
        return this.deferredPrompt !== null;
    }

    // 캐시 상태 확인
    async getCacheStatus() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            const cacheStatus = {};
            
            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                cacheStatus[cacheName] = keys.length;
            }
            
            return cacheStatus;
        }
        
        return {};
    }

    // 캐시 정리
    async clearCache() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
            }
            
            console.log('All caches cleared');
            
            if (utilityFeatures?.notificationManager) {
                utilityFeatures.notificationManager.addNotification(
                    '캐시 정리 완료',
                    '모든 캐시가 삭제되었습니다.',
                    'success'
                );
            }
        }
    }

    // 푸시 알림 구독
    async subscribeToPushNotifications() {
        if ('PushManager' in window && this.swRegistration) {
            try {
                const subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(
                        'YOUR_VAPID_PUBLIC_KEY' // 실제 환경에서는 VAPID 키 사용
                    )
                });
                
                console.log('Push notification subscription:', subscription);
                
                // 서버에 구독 정보 전송
                await this.sendSubscriptionToServer(subscription);
                
                return subscription;
            } catch (error) {
                console.error('Failed to subscribe to push notifications:', error);
            }
        }
    }

    // VAPID 키 변환
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }

    // 구독 정보를 서버에 전송
    async sendSubscriptionToServer(subscription) {
        // 실제 환경에서는 서버 API 호출
        console.log('Sending subscription to server:', subscription);
    }
}

// 동기화 관리자
class SyncManager {
    constructor() {
        this.syncQueue = [];
        this.isProcessing = false;
    }

    // 동기화 작업 추가
    addSyncTask(task) {
        this.syncQueue.push({
            id: Date.now().toString(),
            ...task,
            timestamp: new Date().toISOString(),
            retries: 0,
            maxRetries: 3
        });

        if (!this.isProcessing) {
            this.processSyncQueue();
        }
    }

    // 동기화 큐 처리
    async processSyncQueue() {
        if (this.isProcessing || this.syncQueue.length === 0) return;

        this.isProcessing = true;

        while (this.syncQueue.length > 0) {
            const task = this.syncQueue.shift();
            
            try {
                await this.executeTask(task);
                console.log('Sync task completed:', task.id);
            } catch (error) {
                console.error('Sync task failed:', task.id, error);
                
                // 재시도
                if (task.retries < task.maxRetries) {
                    task.retries++;
                    this.syncQueue.push(task);
                }
            }
        }

        this.isProcessing = false;
    }

    // 작업 실행
    async executeTask(task) {
        switch (task.type) {
            case 'upload':
                return await this.uploadData(task.data);
            case 'delete':
                return await this.deleteData(task.data);
            case 'update':
                return await this.updateData(task.data);
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    // 데이터 업로드
    async uploadData(data) {
        // GitHub API를 통한 데이터 업로드
        return await githubAPI.uploadFile(
            data.repository,
            data.path,
            data.content,
            data.message
        );
    }

    // 데이터 삭제
    async deleteData(data) {
        // GitHub API를 통한 데이터 삭제
        return await githubAPI.deleteFile(
            data.repository,
            data.path,
            data.message
        );
    }

    // 데이터 업데이트
    async updateData(data) {
        // GitHub API를 통한 데이터 업데이트
        return await githubAPI.updateFile(
            data.repository,
            data.path,
            data.content,
            data.message
        );
    }
}

// 전역 인스턴스
const pwaManager = new PWAManager();

// PWA 관련 이벤트 리스너
window.addEventListener('load', () => {
    // PWA 상태 확인
    if (pwaManager.isPWA()) {
        console.log('Running as PWA');
        document.body.classList.add('pwa-mode');
    }
});

// 페이지 가시성 변경 시 동기화
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
        pwaManager.triggerBackgroundSync();
    }
});

