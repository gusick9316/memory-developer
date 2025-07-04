// 메인 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 모든 매니저 초기화
    window.authSystem.init();
    window.uiManager.init();
    window.memoriesManager.init();
    window.studentsManager.init();
    window.developersManager.init();
    
    // 파일 업로드 초기화
    window.uiManager.initFileUploads();
    
    console.log('학교 추억 저장소 애플리케이션이 초기화되었습니다.');
});

// 전역 에러 핸들러
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    if (window.uiManager) {
        window.uiManager.showNotification('예상치 못한 오류가 발생했습니다.', 'error');
    }
});

// 네트워크 연결 상태 모니터링
window.addEventListener('online', function() {
    if (window.uiManager) {
        window.uiManager.showNotification('인터넷 연결이 복구되었습니다.', 'success');
    }
});

window.addEventListener('offline', function() {
    if (window.uiManager) {
        window.uiManager.showNotification('인터넷 연결이 끊어졌습니다.', 'error');
    }
});

// 페이지 새로고침 시 확인 (데이터 손실 방지)
window.addEventListener('beforeunload', function(e) {
    const modals = document.querySelectorAll('.modal-overlay.active');
    if (modals.length > 0) {
        e.preventDefault();
        e.returnValue = '작성 중인 내용이 있습니다. 정말로 페이지를 떠나시겠습니까?';
        return e.returnValue;
    }
});

// 서비스 워커 등록 (PWA 지원)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// 터치 디바이스 감지 및 최적화
function isTouchDevice() {
    return (('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0));
}

if (isTouchDevice()) {
    document.body.classList.add('touch-device');
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter로 모달 폼 제출
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeModal = document.querySelector('.modal-overlay.active .modal');
        if (activeModal) {
            const submitBtn = activeModal.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
            }
        }
    }
    
    // 탭 전환 (Ctrl/Cmd + 1/2/3)
    if ((e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const tabMap = {
            '1': 'memories',
            '2': 'students', 
            '3': 'developers'
        };
        const tabName = tabMap[e.key];
        if (window.uiManager && document.getElementById('main-screen').classList.contains('active')) {
            window.uiManager.switchTab(tabName);
        }
    }
});

// 이미지 로딩 최적화
function optimizeImages() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// 페이지 로드 완료 후 이미지 최적화 실행
window.addEventListener('load', optimizeImages);

// 동적으로 추가된 이미지에 대한 최적화
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    const lazyImages = node.querySelectorAll ? node.querySelectorAll('img[loading="lazy"]') : [];
                    lazyImages.forEach(img => {
                        if ('IntersectionObserver' in window) {
                            const imageObserver = new IntersectionObserver((entries, observer) => {
                                entries.forEach(entry => {
                                    if (entry.isIntersecting) {
                                        const img = entry.target;
                                        img.classList.remove('lazy');
                                        imageObserver.unobserve(img);
                                    }
                                });
                            });
                            imageObserver.observe(img);
                        }
                    });
                }
            });
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 성능 모니터링
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('페이지 로드 시간:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
        }, 0);
    });
}

