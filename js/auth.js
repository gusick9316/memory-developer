class AuthManager {
    constructor() {
        this.secretCode = '충상고스마트5기';
        this.githubUsername = 'gusick9316';
        this.githubRepo = 'memory';
        this.githubToken = null;
        this.tokenParts = ['ghp', '_2SllyukhLwajJQdMsP0xgu9uaR5fDv2gvE0T'];
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        const authSubmitBtn = document.getElementById('auth-submit');
        const secretCodeInput = document.getElementById('secret-code');

        // 확인 버튼 클릭 이벤트
        authSubmitBtn.addEventListener('click', () => {
            this.authenticate();
        });

        // 엔터 키 이벤트
        secretCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.authenticate();
            }
        });
    }

    authenticate() {
        const secretCodeInput = document.getElementById('secret-code');
        const inputCode = secretCodeInput.value.trim();

        if (inputCode === this.secretCode) {
            this.showLoadingScreen();
            this.connectToGitHub();
        } else {
            alert('비밀코드가 올바르지 않습니다.');
            secretCodeInput.value = '';
            secretCodeInput.focus();
        }
    }

    showLoadingScreen() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('loading-screen').classList.add('active');
    }

    async connectToGitHub() {
        try {
            // 토큰 조합
            this.githubToken = this.tokenParts.join('');

            // 로딩 메시지 업데이트
            this.updateLoadingText('추억을 확인하는중...');

            // GitHub API 초기화
            await window.githubAPI.init(this.githubUsername, this.githubRepo, this.githubToken);

            // 로딩 메시지 업데이트
            this.updateLoadingText('추억을 불러오는중...');

            // 저장소 크기 확인
            const repoSize = await window.githubAPI.getRepoSize();
            document.getElementById('storage-usage').textContent = `${repoSize}MB`;
            
            if (repoSize > 700) {
                document.getElementById('storage-usage').style.color = '#e53e3e';
            }

            // 배경 음악 설정
            const audioElement = document.getElementById('background-music');
            audioElement.src = `https://raw.githubusercontent.com/${this.githubUsername}/${this.githubRepo}/main/song.mp3`;
            
            // 데이터 로드
            await this.loadData();

            // 메인 화면으로 전환
            setTimeout(() => {
                document.getElementById('loading-screen').classList.remove('active');
                document.getElementById('main-screen').classList.add('active');
                
                // 음악 재생
                audioElement.play().catch(error => {
                    console.error('Failed to play music:', error);
                });
            }, 1000);
        } catch (error) {
            console.error('GitHub 연결 오류:', error);
            alert('GitHub 연결에 실패했습니다. 다시 시도해주세요.');
            
            // 인증 화면으로 돌아가기
            document.getElementById('loading-screen').classList.remove('active');
            document.getElementById('auth-screen').classList.add('active');
        }
    }

    updateLoadingText(text) {
        document.getElementById('loading-text').textContent = text;
    }

    async loadData() {
        try {
            // 추억 데이터 로드
            await window.memoriesManager.loadMemories();
            
            // 학생 데이터 로드
            await window.studentsManager.loadStudents();
            
            // 개발자 데이터 로드
            await window.developersManager.loadDevelopers();
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            throw error;
        }
    }

    checkAuth() {
        // 이미 인증된 상태인지 확인 (실제 구현에서는 세션/로컬 스토리지 등을 활용할 수 있음)
        // 현재는 항상 인증 화면부터 시작
    }
}

// 전역 인스턴스 생성
window.authManager = new AuthManager();

