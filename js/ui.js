// UI 관련 기능
class UIManager {
    constructor() {
        this.currentTab = 'memories';
        this.currentModal = null;
    }

    init() {
        this.bindTabEvents();
        this.bindModalEvents();
        this.bindMusicEvents();
    }

    bindTabEvents() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // 현재 활성 탭 제거
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // 새 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
    }

    bindModalEvents() {
        const modalOverlay = document.getElementById('modal-overlay');
        
        // 모달 외부 클릭 시 닫기
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal();
            }
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeModal();
            }
        });

        // 취소 버튼들
        document.getElementById('memory-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('student-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('developer-cancel').addEventListener('click', () => this.closeModal());
    }

    showModal(modalId, title = null) {
        this.currentModal = modalId;
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        
        if (title) {
            const titleElement = modal.querySelector('h3');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }

        // 모든 모달 숨기기
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
        });

        // 선택된 모달 표시
        modal.style.display = 'block';
        overlay.classList.add('active');

        // 첫 번째 입력 필드에 포커스
        const firstInput = modal.querySelector('input[type="text"], input[type="number"]');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        this.currentModal = null;

        // 모든 폼 초기화
        document.querySelectorAll('.modal form').forEach(form => {
            form.reset();
            
            // 삭제 버튼 숨기기
            const deleteBtn = form.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'none';
            }

            // 제출 버튼 텍스트 초기화
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = '추가';
            }
        });

        // 파일 입력 라벨 초기화
        document.querySelectorAll('.file-upload label').forEach(label => {
            const input = label.parentNode.querySelector('input[type="file"]');
            const originalText = label.textContent.includes('최대') ? 
                label.textContent : '사진 선택 (최대 10MB)';
            label.textContent = originalText;
        });
    }

    bindMusicEvents() {
        const musicToggle = document.getElementById('music-toggle');
        const audio = document.getElementById('background-music');

        musicToggle.addEventListener('click', () => {
            if (audio.paused) {
                audio.play().then(() => {
                    musicToggle.classList.add('active');
                }).catch(error => {
                    console.error('Failed to play music:', error);
                });
            } else {
                audio.pause();
                musicToggle.classList.remove('active');
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#e53e3e' : type === 'success' ? '#48bb78' : '#667eea'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            font-weight: 500;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;

        // 애니메이션 CSS 추가
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // 3초 후 제거
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    showLoading(element) {
        const originalText = element.textContent;
        element.textContent = '처리중...';
        element.disabled = true;

        return () => {
            element.textContent = originalText;
            element.disabled = false;
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    validateImageFile(file) {
        // 파일 크기 체크 (10MB)
        if (!window.githubAPI.validateFileSize(file)) {
            this.showNotification('파일 크기는 10MB 이하여야 합니다.', 'error');
            return false;
        }

        // 이미지 파일 타입 체크
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showNotification('지원되는 이미지 형식: JPG, PNG, GIF, WebP', 'error');
            return false;
        }

        return true;
    }

    updateFileLabel(input, label) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (this.validateImageFile(file)) {
                    label.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
                } else {
                    input.value = '';
                }
            } else {
                label.textContent = '사진 선택 (최대 10MB)';
            }
        });
    }

    initFileUploads() {
        document.querySelectorAll('.file-upload').forEach(upload => {
            const input = upload.querySelector('input[type="file"]');
            const label = upload.querySelector('label');
            this.updateFileLabel(input, label);
        });
    }

    async updateStorageInfo() {
        try {
            const size = await window.githubAPI.getRepositorySize();
            const storageElement = document.getElementById('storage-usage');
            const storageInfo = document.querySelector('.storage-info');
            
            storageElement.textContent = `${size}MB`;
            
            if (size > 700) {
                storageInfo.classList.add('warning');
            } else {
                storageInfo.classList.remove('warning');
            }
        } catch (error) {
            console.error('Failed to update storage info:', error);
        }
    }
}

// 전역 UI 매니저 인스턴스
window.uiManager = new UIManager();

