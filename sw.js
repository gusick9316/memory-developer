// Service Worker for 추억 저장소
const CACHE_NAME = 'memory-storage-v1.0.0';
const OFFLINE_URL = '/offline.html';

// 캐시할 리소스 목록
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/github-api.js',
    '/cache-manager.js',
    '/performance-optimizer.js',
    '/advanced-ui.js',
    '/security-manager.js',
    '/utility-features.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 동적 캐시할 URL 패턴
const DYNAMIC_CACHE_PATTERNS = [
    /^https:\/\/api\.github\.com\//,
    /^https:\/\/raw\.githubusercontent\.com\//
];

// 설치 이벤트
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static resources...');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('Static resources cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Failed to cache static resources:', error);
            })
    );
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // HTML 요청 처리
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigateRequest(request));
        return;
    }

    // API 요청 처리
    if (isDynamicCacheUrl(request.url)) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // 정적 리소스 처리
    event.respondWith(handleStaticRequest(request));
});

// 네비게이션 요청 처리 (HTML 페이지)
async function handleNavigateRequest(request) {
    try {
        // 네트워크 우선 전략
        const networkResponse = await fetch(request);
        
        // 성공적인 응답을 캐시에 저장
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache...');
        
        // 캐시에서 찾기
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // 오프라인 페이지 반환
        return caches.match('/');
    }
}

// API 요청 처리
async function handleApiRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        // 네트워크 우선 전략
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // GET 요청만 캐시
            if (request.method === 'GET') {
                cache.put(request, networkResponse.clone());
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.log('API request failed, trying cache...');
        
        // GET 요청의 경우 캐시에서 찾기
        if (request.method === 'GET') {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // 오프라인 응답 생성
        return new Response(
            JSON.stringify({
                error: 'Network unavailable',
                offline: true,
                timestamp: new Date().toISOString()
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

// 정적 리소스 처리
async function handleStaticRequest(request) {
    // 캐시 우선 전략
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Failed to fetch static resource:', request.url);
        
        // 기본 응답 반환
        return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 동적 캐시 URL 확인
function isDynamicCacheUrl(url) {
    return DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// 백그라운드 동기화 실행
async function doBackgroundSync() {
    try {
        // 오프라인 중에 저장된 데이터 동기화
        const pendingData = await getPendingData();
        
        for (const data of pendingData) {
            try {
                await syncData(data);
                await removePendingData(data.id);
            } catch (error) {
                console.error('Failed to sync data:', error);
            }
        }
        
        // 클라이언트에 동기화 완료 알림
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// 대기 중인 데이터 가져오기
async function getPendingData() {
    // IndexedDB에서 대기 중인 데이터 조회
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MemoryStorageDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['pendingSync'], 'readonly');
            const store = transaction.objectStore('pendingSync');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
        
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('pendingSync')) {
                db.createObjectStore('pendingSync', { keyPath: 'id' });
            }
        };
    });
}

// 데이터 동기화
async function syncData(data) {
    const response = await fetch(data.url, {
        method: data.method,
        headers: data.headers,
        body: data.body
    });
    
    if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
    }
    
    return response;
}

// 대기 중인 데이터 제거
async function removePendingData(id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MemoryStorageDB', 1);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['pendingSync'], 'readwrite');
            const store = transaction.objectStore('pendingSync');
            const deleteRequest = store.delete(id);
            
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
    });
}

// 푸시 알림 처리
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: '확인',
                icon: '/check-icon.png'
            },
            {
                action: 'close',
                title: '닫기',
                icon: '/close-icon.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('추억 저장소', options)
    );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// 메시지 처리
self.addEventListener('message', (event) => {
    console.log('Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            cacheUrls(event.data.urls)
        );
    }
});

// URL 캐싱
async function cacheUrls(urls) {
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urls) {
        try {
            await cache.add(url);
            console.log('Cached:', url);
        } catch (error) {
            console.error('Failed to cache:', url, error);
        }
    }
}

// 주기적 백그라운드 동기화 (실험적 기능)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(doPeriodicSync());
    }
});

// 주기적 동기화 실행
async function doPeriodicSync() {
    try {
        // 새로운 콘텐츠 확인 및 캐시 업데이트
        console.log('Performing periodic sync...');
        
        // 캐시 정리
        await cleanupCache();
        
        // 새로운 데이터 프리로드
        await preloadNewContent();
        
    } catch (error) {
        console.error('Periodic sync failed:', error);
    }
}

// 캐시 정리
async function cleanupCache() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    // 오래된 캐시 항목 삭제 (7일 이상)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
        const response = await cache.match(request);
        const dateHeader = response.headers.get('date');
        
        if (dateHeader) {
            const responseDate = new Date(dateHeader).getTime();
            if (responseDate < oneWeekAgo) {
                await cache.delete(request);
                console.log('Deleted old cache entry:', request.url);
            }
        }
    }
}

// 새로운 콘텐츠 프리로드
async function preloadNewContent() {
    // 중요한 리소스 미리 로드
    const importantUrls = [
        '/',
        '/styles.css',
        '/app.js'
    ];
    
    await cacheUrls(importantUrls);
}

// 에러 처리
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully');

