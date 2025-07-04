// 인증 관련 기능
class AuthSystem {
    constructor() {
        this.secretCode = '충상고스마트5기';
        this.loadingMessages = [
            '추억에 연결하는중...',
            '추억을 확인하는중...',
            '추억을 불러오는중...'
        ];
        this.currentMessageIndex = 0;
        this.loadingInterval = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const authSubmit = document.getElementById('auth-submit');
        const secretCodeInput = document.getElementById('secret-code');

        authSubmit.addEventListener('click', () => this.handleAuth());
        secretCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAuth();
            }
        });
    }

    async handleAuth() {
        const inputCode = document.getElementById('secret-code').value;
        
        if (inputCode !== this.secretCode) {
            this.showError('비밀코드가 올바르지 않습니다.');
            return;
        }

        this.showLoadingScreen();
        await this.connectToGitHub();
    }

    showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #e53e3e;
            margin-top: 1rem;
            text-align: center;
            font-weight: 500;
        `;
        errorDiv.textContent = message;

        const authForm = document.querySelector('.auth-form');
        authForm.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
    }

    showLoadingScreen() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('loading-screen').classList.add('active');
        
        this.startLoadingAnimation();
    }

    startLoadingAnimation() {
        const loadingText = document.getElementById('loading-text');
        
        this.loadingInterval = setInterval(() => {
            loadingText.textContent = this.loadingMessages[this.currentMessageIndex];
            this.currentMessageIndex = (this.currentMessageIndex + 1) % this.loadingMessages.length;
        }, 1500);
    }

    stopLoadingAnimation() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    async connectToGitHub() {
        try {
            // GitHub 연결 확인
            const isConnected = await window.githubAPI.checkConnection();
            
            if (!isConnected) {
                throw new Error('GitHub 연결에 실패했습니다.');
            }

            // 저장소 크기 확인
            await this.updateStorageInfo();

            // 음악 파일 로드
            await this.loadBackgroundMusic();

            // 기존 데이터 로드
            await this.loadExistingData();

            // 메인 화면으로 전환
            setTimeout(() => {
                this.showMainScreen();
            }, 2000);

        } catch (error) {
            console.error('GitHub connection failed:', error);
            this.stopLoadingAnimation();
            
            const loadingText = document.getElementById('loading-text');
            loadingText.textContent = '연결에 실패했습니다. 다시 시도해주세요.';
            loadingText.style.color = '#e53e3e';

            setTimeout(() => {
                this.showAuthScreen();
            }, 3000);
        }
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

    async loadBackgroundMusic() {
        try {
            const musicUrl = await window.githubAPI.getMusicUrl();
            const audio = document.getElementById('background-music');
            audio.src = musicUrl;
            
            // 음악 자동 재생 (사용자 상호작용 후)
            audio.load();
        } catch (error) {
            console.error('Failed to load background music:', error);
        }
    }

    async loadExistingData() {
        try {
            // 추억 데이터 로드
            await window.memoriesManager.loadMemories();
            
            // 학생 데이터 로드
            await window.studentsManager.loadStudents();
            
            // 개발자 데이터 로드
            await window.developersManager.loadDevelopers();
            
        } catch (error) {
            console.error('Failed to load existing data:', error);
        }
    }

    showMainScreen() {
        this.stopLoadingAnimation();
        document.getElementById('loading-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        
        // 음악 재생 시작
        this.startBackgroundMusic();
    }

    showAuthScreen() {
        this.stopLoadingAnimation();
        document.getElementById('loading-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        
        // 입력 필드 초기화
        document.getElementById('secret-code').value = '';
    }

    async startBackgroundMusic() {
        try {
            const audio = document.getElementById('background-music');
            const musicToggle = document.getElementById('music-toggle');
            
            // 사용자 상호작용 후 음악 재생
            const playMusic = async () => {
                try {
                    await audio.play();
                    musicToggle.classList.add('active');
                } catch (error) {
                    console.log('Auto-play prevented by browser policy');
                }
            };

            // 첫 번째 클릭 이벤트에서 음악 재생
            const enableMusic = () => {
                playMusic();
                document.removeEventListener('click', enableMusic);
            };
            
            document.addEventListener('click', enableMusic);
            
        } catch (error) {
            console.error('Failed to start background music:', error);
        }
    }
}

// 전역 인증 시스템 인스턴스
window.authSystem = new AuthSystem();

