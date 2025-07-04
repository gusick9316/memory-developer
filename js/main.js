document.addEventListener('DOMContentLoaded', () => {
    // UI 관리자 초기화
    window.uiManager.init();
    
    // 인증 관리자 초기화
    window.authManager.init();
    
    // 추억 관리자 초기화
    window.memoriesManager.init();
    
    // 학생 관리자 초기화
    window.studentsManager.init();
    
    // 개발자 관리자 초기화
    window.developersManager.init();
});

