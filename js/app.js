// 전역 변수
let currentTab = 'memories';
let isLoggedIn = false;
let repositoryData = [];
let memoriesData = [];
let studentsData = [];
let developersData = [];
let currentEditingMemory = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    // 로그인 상태 확인
    const savedLogin = localStorage.getItem('memoryStorageLogin');
    if (savedLogin === 'true') {
        showLoadingScreen();
        connectToGitHub();
    } else {
        showLoginScreen();
    }
}

// 화면 전환 함수들
function showLoginScreen() {
    hideAllScreens();
    document.getElementById('loginScreen').classList.add('active');
}

function showLoadingScreen() {
    hideAllScreens();
    document.getElementById('loadingScreen').classList.add('active');
}

function showMainScreen() {
    hideAllScreens();
    document.getElementById('mainScreen').classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// 로그인 처리
function login() {
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('loginError');
    
    if (password === '충상고스마트5기') {
        errorElement.textContent = '';
        localStorage.setItem('memoryStorageLogin', 'true');
        showLoadingScreen();
        connectToGitHub();
    } else {
        errorElement.textContent = '비밀번호가 올바르지 않습니다.';
        document.getElementById('passwordInput').value = '';
    }
}

// Enter 키로 로그인
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && document.getElementById('loginScreen').classList.contains('active')) {
        login();
    }
});

// GitHub 연결
async function connectToGitHub() {
    try {
        // 토큰 초기화
        updateStatus('userStatus', '연결 중...');
        githubAPI.initializeToken();
        
        // 사용자 연결 테스트
        const connectionTest = await githubAPI.testConnection();
        if (connectionTest.success) {
            updateStatus('userStatus', '연결됨');
            updateStatus('repoStatus', '확인 중...');
            
            // 저장소 확인
            const repoCheck = await githubAPI.checkRepositories();
            if (repoCheck.success) {
                repositoryData = repoCheck.repositories;
                updateStatus('repoStatus', '연결됨');
                updateStatus('tokenStatus', '인증됨');
                
                // 데이터 로드
                await loadAllData();
                
                setTimeout(() => {
                    showMainScreen();
                    initializeMainScreen();
                }, 1000);
            } else {
                throw new Error('저장소 연결 실패');
            }
        } else {
            throw new Error('사용자 인증 실패');
        }
    } catch (error) {
        console.error('GitHub 연결 실패:', error);
        updateStatus('userStatus', '실패');
        updateStatus('repoStatus', '실패');
        updateStatus('tokenStatus', '실패');
        
        setTimeout(() => {
            alert('GitHub 연결에 실패했습니다. 다시 시도해주세요.');
            localStorage.removeItem('memoryStorageLogin');
            showLoginScreen();
        }, 2000);
    }
}

// 상태 업데이트
function updateStatus(elementId, status) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        if (status === '연결됨' || status === '인증됨') {
            element.style.color = '#27ae60';
        } else if (status === '실패') {
            element.style.color = '#e74c3c';
        } else {
            element.style.color = '#f39c12';
        }
    }
}

// 메인 화면 초기화
function initializeMainScreen() {
    // 저장소 선택 옵션 생성
    populateRepositoryOptions();
    
    // 데이터 표시
    displayMemories();
    displayStudents();
    displayDevelopers();
}

// 저장소 옵션 채우기
function populateRepositoryOptions() {
    const select = document.getElementById('memoryRepo');
    select.innerHTML = '';
    
    repositoryData.forEach(repo => {
        if (!repo.special && repo.exists) {
            const option = document.createElement('option');
            option.value = repo.name;
            option.textContent = repo.name;
            option.dataset.size = repo.size || 0;
            select.appendChild(option);
        }
    });
    
    // 저장소 변경 시 용량 표시
    select.addEventListener('change', updateRepositoryCapacity);
    if (select.options.length > 0) {
        updateRepositoryCapacity();
    }
}

// 저장소 용량 업데이트
function updateRepositoryCapacity() {
    const select = document.getElementById('memoryRepo');
    const capacityDiv = document.getElementById('repoCapacity');
    
    if (select.selectedIndex >= 0) {
        const selectedOption = select.options[select.selectedIndex];
        const size = parseInt(selectedOption.dataset.size) || 0;
        const capacityStatus = githubAPI.getRepositoryCapacityStatus(size);
        
        capacityDiv.textContent = capacityStatus.message;
        capacityDiv.className = 'repo-capacity';
        
        if (capacityStatus.status === 'danger') {
            capacityDiv.classList.add('danger');
        } else if (capacityStatus.status === 'warning') {
            capacityDiv.classList.add('warning');
        }
    }
}

// 탭 전환
function switchTab(tabName) {
    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    
    // 탭 콘텐츠 표시
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    currentTab = tabName;
}

// 모든 데이터 로드
async function loadAllData() {
    await loadMemories();
    await loadStudents();
    await loadDevelopers();
}

// 추억 데이터 로드
async function loadMemories() {
    memoriesData = [];
    
    for (const repo of repositoryData) {
        if (!repo.special && repo.exists) {
            try {
                const listResult = await githubAPI.listFiles(repo.name);
                if (listResult.success) {
                    for (const item of listResult.files) {
                        if (item.type === 'dir') {
                            // 폴더 내 JSON 파일 찾기
                            const folderFiles = await githubAPI.listFiles(repo.name, item.name);
                            if (folderFiles.success) {
                                const jsonFile = folderFiles.files.find(f => f.name.endsWith('.json'));
                                if (jsonFile) {
                                    const jsonData = await githubAPI.downloadFile(repo.name, jsonFile.path);
                                    if (jsonData.success) {
                                        try {
                                            const memoryData = JSON.parse(jsonData.content);
                                            memoryData.id = item.name;
                                            memoryData.repository = repo.name;
                                            memoryData.folderPath = item.name;
                                            memoriesData.push(memoryData);
                                        } catch (e) {
                                            console.error('JSON 파싱 실패:', e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`저장소 ${repo.name} 로드 실패:`, error);
            }
        }
    }
    
    // 날짜순 정렬 (오래된 순)
    memoriesData.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// 학생 데이터 로드
async function loadStudents() {
    studentsData = [];
    
    const memoryRepo = repositoryData.find(repo => repo.name === 'memory' && repo.special);
    if (memoryRepo && memoryRepo.exists) {
        try {
            const listResult = await githubAPI.listFiles('memory');
            if (listResult.success) {
                for (const item of listResult.files) {
                    if (item.type === 'dir') {
                        // 폴더 내 JSON 파일 찾기
                        const folderFiles = await githubAPI.listFiles('memory', item.name);
                        if (folderFiles.success) {
                            const jsonFile = folderFiles.files.find(f => f.name.endsWith('.json'));
                            if (jsonFile) {
                                const jsonData = await githubAPI.downloadFile('memory', jsonFile.path);
                                if (jsonData.success) {
                                    try {
                                        const studentData = JSON.parse(jsonData.content);
                                        if (studentData.type === 'student' || studentData.type === 'teacher') {
                                            studentData.id = item.name;
                                            studentData.folderPath = item.name;
                                            studentsData.push(studentData);
                                        }
                                    } catch (e) {
                                        console.error('JSON 파싱 실패:', e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('학생 데이터 로드 실패:', error);
        }
    }
    
    // 선생님을 먼저, 그 다음 학생 순으로 정렬
    studentsData.sort((a, b) => {
        if (a.type === 'teacher' && b.type === 'student') return -1;
        if (a.type === 'student' && b.type === 'teacher') return 1;
        return a.order - b.order;
    });
}

// 개발자 데이터 로드
async function loadDevelopers() {
    developersData = [];
    
    const memoryRepo = repositoryData.find(repo => repo.name === 'memory' && repo.special);
    if (memoryRepo && memoryRepo.exists) {
        try {
            const listResult = await githubAPI.listFiles('memory');
            if (listResult.success) {
                for (const item of listResult.files) {
                    if (item.type === 'dir') {
                        // 폴더 내 JSON 파일 찾기
                        const folderFiles = await githubAPI.listFiles('memory', item.name);
                        if (folderFiles.success) {
                            const jsonFile = folderFiles.files.find(f => f.name.endsWith('.json'));
                            if (jsonFile) {
                                const jsonData = await githubAPI.downloadFile('memory', jsonFile.path);
                                if (jsonData.success) {
                                    try {
                                        const developerData = JSON.parse(jsonData.content);
                                        if (developerData.type === 'developer') {
                                            developerData.id = item.name;
                                            developerData.folderPath = item.name;
                                            developersData.push(developerData);
                                        }
                                    } catch (e) {
                                        console.error('JSON 파싱 실패:', e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('개발자 데이터 로드 실패:', error);
        }
    }
    
    // 추가된 순서대로 정렬
    developersData.sort((a, b) => a.order - b.order);
}

// 추억 표시
function displayMemories() {
    const container = document.getElementById('memoriesList');
    container.innerHTML = '';
    
    memoriesData.forEach(memory => {
        const memoryElement = document.createElement('div');
        memoryElement.className = 'memory-item fade-in';
        memoryElement.onclick = () => showMemoryDetail(memory);
        
        memoryElement.innerHTML = `
            <h3>${memory.title}</h3>
            <div class="memory-meta">
                <span><i class="fas fa-user"></i> ${memory.author}</span>
                <span><i class="fas fa-calendar"></i> ${memory.date}</span>
            </div>
        `;
        
        container.appendChild(memoryElement);
    });
}

// 학생 표시
function displayStudents() {
    const container = document.getElementById('studentsList');
    container.innerHTML = '';
    
    studentsData.forEach((student, index) => {
        const studentElement = document.createElement('div');
        studentElement.className = `student-item fade-in ${student.type === 'teacher' ? 'teacher' : ''}`;
        
        const imagePath = `${student.folderPath}/${student.imageName}`;
        const imageUrl = githubAPI.getImageUrl('memory', imagePath);
        
        studentElement.innerHTML = `
            <img src="${imageUrl}" alt="${student.name}" class="student-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPuydtOuvuOyngCDsl4bsnYw8L3RleHQ+Cjwvc3ZnPg=='">
            <div class="student-name">${student.name}</div>
            <div class="student-actions">
                <button class="action-btn edit-btn" onclick="editStudent('${student.id}')">수정</button>
                <button class="action-btn delete-btn" onclick="deleteStudent('${student.id}')">삭제</button>
                <button class="action-btn move-btn" onclick="moveStudentUp(${index})">⬆</button>
                <button class="action-btn move-btn" onclick="moveStudentDown(${index})">⬇</button>
            </div>
        `;
        
        container.appendChild(studentElement);
    });
}

// 개발자 표시
function displayDevelopers() {
    const container = document.getElementById('developersList');
    container.innerHTML = '';
    
    developersData.forEach(developer => {
        const developerElement = document.createElement('div');
        developerElement.className = 'developer-item fade-in';
        
        const imagePath = `${developer.folderPath}/${developer.imageName}`;
        const imageUrl = githubAPI.getImageUrl('memory', imagePath);
        
        developerElement.innerHTML = `
            <img src="${imageUrl}" alt="${developer.name}" class="developer-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPuydtOuvuOyngCDsl4bsnYw8L3RleHQ+Cjwvc3ZnPg=='">
            <div class="developer-name">${developer.name}</div>
            <div class="student-actions">
                <button class="action-btn delete-btn" onclick="deleteDeveloper('${developer.id}')">삭제</button>
            </div>
        `;
        
        container.appendChild(developerElement);
    });
}

// 모달 관련 함수들
function openMemoryForm() {
    document.getElementById('memoryModal').style.display = 'block';
    // 현재 날짜로 초기화
    const today = new Date();
    document.getElementById('memoryYear').value = today.getFullYear();
    document.getElementById('memoryMonth').value = today.getMonth() + 1;
    document.getElementById('memoryDay').value = today.getDate();
}

function openStudentForm() {
    document.getElementById('studentModal').style.display = 'block';
}

function openDeveloperForm() {
    document.getElementById('developerModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // 폼 초기화
    if (modalId === 'memoryModal') {
        document.getElementById('memoryTitle').value = '';
        document.getElementById('memoryAuthor').value = '';
        document.getElementById('memoryImages').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        currentEditingMemory = null;
    } else if (modalId === 'studentModal') {
        document.getElementById('studentName').value = '';
        document.getElementById('studentImage').value = '';
        document.getElementById('studentImagePreview').innerHTML = '';
    } else if (modalId === 'developerModal') {
        document.getElementById('developerName').value = '';
        document.getElementById('developerImage').value = '';
        document.getElementById('developerImagePreview').innerHTML = '';
    }
}

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// 이미지 미리보기
document.getElementById('memoryImages').addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    Array.from(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = URL.createObjectURL(file);
            preview.appendChild(img);
        }
    });
});

document.getElementById('studentImage').addEventListener('change', function(e) {
    const preview = document.getElementById('studentImagePreview');
    preview.innerHTML = '';
    
    if (e.target.files[0] && e.target.files[0].type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.src = URL.createObjectURL(e.target.files[0]);
        preview.appendChild(img);
    }
});

document.getElementById('developerImage').addEventListener('change', function(e) {
    const preview = document.getElementById('developerImagePreview');
    preview.innerHTML = '';
    
    if (e.target.files[0] && e.target.files[0].type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.src = URL.createObjectURL(e.target.files[0]);
        preview.appendChild(img);
    }
});

// 로그아웃
function logout() {
    localStorage.removeItem('memoryStorageLogin');
    location.reload();
}



// 추억 저장
async function saveMemory() {
    const title = document.getElementById('memoryTitle').value.trim();
    const author = document.getElementById('memoryAuthor').value.trim();
    const year = document.getElementById('memoryYear').value;
    const month = document.getElementById('memoryMonth').value;
    const day = document.getElementById('memoryDay').value;
    const repository = document.getElementById('memoryRepo').value;
    const images = document.getElementById('memoryImages').files;
    
    // 유효성 검사
    if (!title || !author || !year || !month || !day || !repository) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    // 날짜 형식 생성
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // 저장소 용량 체크
    const selectedRepo = repositoryData.find(repo => repo.name === repository);
    if (selectedRepo) {
        const capacityStatus = githubAPI.getRepositoryCapacityStatus(selectedRepo.size || 0);
        if (capacityStatus.status === 'danger') {
            alert('선택한 저장소의 용량이 초과되었습니다. 다른 저장소를 선택해주세요.');
            return;
        }
    }
    
    try {
        // 로딩 상태 표시
        const saveBtn = document.querySelector('#memoryModal .save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
        
        // 폴더명 생성 (제목을 파일명으로 사용 가능하게 변환)
        const folderName = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const uniqueFolderName = `${folderName}_${timestamp}`;
        
        // JSON 데이터 생성
        const memoryData = {
            title: title,
            author: author,
            date: date,
            images: [],
            createdAt: new Date().toISOString()
        };
        
        // 이미지 업로드
        if (images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const file = images[i];
                
                // 파일 크기 체크 (25MB)
                if (file.size > 25 * 1024 * 1024) {
                    alert(`${file.name} 파일이 25MB를 초과합니다.`);
                    continue;
                }
                
                const fileExtension = file.name.split('.').pop();
                const imageName = `image_${i + 1}.${fileExtension}`;
                const imagePath = `${uniqueFolderName}/${imageName}`;
                
                const uploadResult = await githubAPI.uploadImage(repository, imagePath, file, `Add image ${imageName} to ${title}`);
                if (uploadResult.success) {
                    memoryData.images.push(imageName);
                } else {
                    console.error('이미지 업로드 실패:', uploadResult.error);
                }
            }
        }
        
        // JSON 파일 업로드
        const jsonPath = `${uniqueFolderName}/data.json`;
        const jsonContent = JSON.stringify(memoryData, null, 2);
        const jsonUploadResult = await githubAPI.uploadFile(repository, jsonPath, jsonContent, `Add memory: ${title}`);
        
        if (jsonUploadResult.success) {
            alert('추억이 성공적으로 저장되었습니다!');
            closeModal('memoryModal');
            
            // 데이터 새로고침
            await loadMemories();
            displayMemories();
            
            // 저장소 정보 업데이트
            await githubAPI.checkRepositories().then(result => {
                if (result.success) {
                    repositoryData = result.repositories;
                    populateRepositoryOptions();
                }
            });
        } else {
            throw new Error(jsonUploadResult.error);
        }
        
        // 버튼 상태 복원
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
    } catch (error) {
        console.error('추억 저장 실패:', error);
        alert('추억 저장에 실패했습니다: ' + error.message);
        
        // 버튼 상태 복원
        const saveBtn = document.querySelector('#memoryModal .save-btn');
        saveBtn.textContent = '저장';
        saveBtn.disabled = false;
    }
}

// 추억 상세보기
async function showMemoryDetail(memory) {
    const modal = document.getElementById('memoryDetailModal');
    const titleElement = document.getElementById('detailTitle');
    const authorElement = document.getElementById('detailAuthor');
    const dateElement = document.getElementById('detailDate');
    const imagesContainer = document.getElementById('detailImages');
    
    // 기본 정보 표시
    titleElement.textContent = memory.title;
    authorElement.textContent = memory.author;
    dateElement.textContent = memory.date;
    
    // 이미지 로딩 표시
    imagesContainer.innerHTML = '<div class="loading-spinner"></div><p>이미지를 불러오는 중...</p>';
    
    // 현재 편집 중인 추억 설정
    currentEditingMemory = memory;
    
    // 모달 표시
    modal.style.display = 'block';
    
    // 이미지 로드
    try {
        imagesContainer.innerHTML = '';
        
        if (memory.images && memory.images.length > 0) {
            for (const imageName of memory.images) {
                const imagePath = `${memory.folderPath}/${imageName}`;
                const imageUrl = githubAPI.getImageUrl(memory.repository, imagePath);
                
                const img = document.createElement('img');
                img.className = 'detail-image';
                img.src = imageUrl;
                img.alt = imageName;
                img.onclick = () => window.open(imageUrl, '_blank');
                
                // 이미지 로드 에러 처리
                img.onerror = function() {
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPuydtOuvuOyngCDroZzrk5zsl6Trpqw8L3RleHQ+Cjwvc3ZnPg==';
                };
                
                imagesContainer.appendChild(img);
            }
        } else {
            imagesContainer.innerHTML = '<p>업로드된 이미지가 없습니다.</p>';
        }
    } catch (error) {
        console.error('이미지 로드 실패:', error);
        imagesContainer.innerHTML = '<p>이미지를 불러오는데 실패했습니다.</p>';
    }
}

// 추억 수정
function editMemory() {
    if (!currentEditingMemory) return;
    
    // 상세보기 모달 닫기
    closeModal('memoryDetailModal');
    
    // 편집 모달 열기
    document.getElementById('memoryModal').style.display = 'block';
    
    // 기존 데이터로 폼 채우기
    const dateParts = currentEditingMemory.date.split('-');
    document.getElementById('memoryYear').value = dateParts[0];
    document.getElementById('memoryMonth').value = parseInt(dateParts[1]);
    document.getElementById('memoryDay').value = parseInt(dateParts[2]);
    document.getElementById('memoryAuthor').value = currentEditingMemory.author;
    document.getElementById('memoryTitle').value = currentEditingMemory.title;
    document.getElementById('memoryRepo').value = currentEditingMemory.repository;
    
    // 저장 버튼 텍스트 변경
    const saveBtn = document.querySelector('#memoryModal .save-btn');
    saveBtn.textContent = '수정 완료';
    saveBtn.onclick = updateMemory;
}

// 추억 업데이트
async function updateMemory() {
    if (!currentEditingMemory) return;
    
    const title = document.getElementById('memoryTitle').value.trim();
    const author = document.getElementById('memoryAuthor').value.trim();
    const year = document.getElementById('memoryYear').value;
    const month = document.getElementById('memoryMonth').value;
    const day = document.getElementById('memoryDay').value;
    
    // 유효성 검사
    if (!title || !author || !year || !month || !day) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    // 날짜 형식 생성
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    try {
        // 로딩 상태 표시
        const saveBtn = document.querySelector('#memoryModal .save-btn');
        saveBtn.textContent = '수정 중...';
        saveBtn.disabled = true;
        
        // 기존 JSON 데이터 가져오기
        const jsonPath = `${currentEditingMemory.folderPath}/data.json`;
        const jsonData = await githubAPI.downloadFile(currentEditingMemory.repository, jsonPath);
        
        if (jsonData.success) {
            const memoryData = JSON.parse(jsonData.content);
            
            // 데이터 업데이트
            memoryData.title = title;
            memoryData.author = author;
            memoryData.date = date;
            memoryData.updatedAt = new Date().toISOString();
            
            // JSON 파일 업데이트
            const updatedJsonContent = JSON.stringify(memoryData, null, 2);
            const updateResult = await githubAPI.uploadFile(
                currentEditingMemory.repository, 
                jsonPath, 
                updatedJsonContent, 
                `Update memory: ${title}`
            );
            
            if (updateResult.success) {
                alert('추억이 성공적으로 수정되었습니다!');
                closeModal('memoryModal');
                
                // 데이터 새로고침
                await loadMemories();
                displayMemories();
                
                // 편집 상태 초기화
                currentEditingMemory = null;
                saveBtn.textContent = '저장';
                saveBtn.onclick = saveMemory;
            } else {
                throw new Error(updateResult.error);
            }
        } else {
            throw new Error('기존 데이터를 불러올 수 없습니다.');
        }
        
        // 버튼 상태 복원
        saveBtn.disabled = false;
        
    } catch (error) {
        console.error('추억 수정 실패:', error);
        alert('추억 수정에 실패했습니다: ' + error.message);
        
        // 버튼 상태 복원
        const saveBtn = document.querySelector('#memoryModal .save-btn');
        saveBtn.textContent = '수정 완료';
        saveBtn.disabled = false;
    }
}

// 추억 삭제
async function deleteMemory() {
    if (!currentEditingMemory) return;
    
    if (!confirm('정말로 이 추억을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) {
        return;
    }
    
    try {
        // 폴더 전체 삭제
        const deleteResult = await githubAPI.deleteFolder(currentEditingMemory.repository, currentEditingMemory.folderPath);
        
        if (deleteResult.success) {
            alert('추억이 성공적으로 삭제되었습니다.');
            closeModal('memoryDetailModal');
            
            // 데이터 새로고침
            await loadMemories();
            displayMemories();
            
            // 편집 상태 초기화
            currentEditingMemory = null;
            
            // 저장소 정보 업데이트
            await githubAPI.checkRepositories().then(result => {
                if (result.success) {
                    repositoryData = result.repositories;
                    populateRepositoryOptions();
                }
            });
        } else {
            throw new Error(deleteResult.error);
        }
    } catch (error) {
        console.error('추억 삭제 실패:', error);
        alert('추억 삭제에 실패했습니다: ' + error.message);
    }
}

// 학생 저장
async function saveStudent() {
    const name = document.getElementById('studentName').value.trim();
    const type = document.getElementById('studentType').value;
    const imageFile = document.getElementById('studentImage').files[0];
    
    // 유효성 검사
    if (!name || !imageFile) {
        alert('이름과 사진을 모두 입력해주세요.');
        return;
    }
    
    try {
        // 로딩 상태 표시
        const saveBtn = document.querySelector('#studentModal .save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
        
        // 폴더명 생성
        const folderName = name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const uniqueFolderName = `${type}_${folderName}_${timestamp}`;
        
        // 이미지 파일명 생성
        const fileExtension = imageFile.name.split('.').pop();
        const imageName = `photo.${fileExtension}`;
        const imagePath = `${uniqueFolderName}/${imageName}`;
        
        // 순서 계산 (같은 타입 내에서)
        const sameTypeStudents = studentsData.filter(s => s.type === type);
        const order = sameTypeStudents.length;
        
        // JSON 데이터 생성
        const studentData = {
            name: name,
            type: type,
            imageName: imageName,
            order: order,
            createdAt: new Date().toISOString()
        };
        
        // 이미지 업로드
        const imageUploadResult = await githubAPI.uploadImage('memory', imagePath, imageFile, `Add ${type} photo: ${name}`);
        if (!imageUploadResult.success) {
            throw new Error('이미지 업로드 실패: ' + imageUploadResult.error);
        }
        
        // JSON 파일 업로드
        const jsonPath = `${uniqueFolderName}/data.json`;
        const jsonContent = JSON.stringify(studentData, null, 2);
        const jsonUploadResult = await githubAPI.uploadFile('memory', jsonPath, jsonContent, `Add ${type}: ${name}`);
        
        if (jsonUploadResult.success) {
            alert(`${type === 'teacher' ? '선생님' : '학생'}이 성공적으로 추가되었습니다!`);
            closeModal('studentModal');
            
            // 데이터 새로고침
            await loadStudents();
            displayStudents();
        } else {
            throw new Error(jsonUploadResult.error);
        }
        
        // 버튼 상태 복원
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
    } catch (error) {
        console.error('학생 저장 실패:', error);
        alert('저장에 실패했습니다: ' + error.message);
        
        // 버튼 상태 복원
        const saveBtn = document.querySelector('#studentModal .save-btn');
        saveBtn.textContent = '저장';
        saveBtn.disabled = false;
    }
}

// 개발자 저장
async function saveDeveloper() {
    const name = document.getElementById('developerName').value.trim();
    const imageFile = document.getElementById('developerImage').files[0];
    
    // 유효성 검사
    if (!name || !imageFile) {
        alert('이름과 사진을 모두 입력해주세요.');
        return;
    }
    
    try {
        // 로딩 상태 표시
        const saveBtn = document.querySelector('#developerModal .save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
        
        // 폴더명 생성
        const folderName = name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const uniqueFolderName = `developer_${folderName}_${timestamp}`;
        
        // 이미지 파일명 생성
        const fileExtension = imageFile.name.split('.').pop();
        const imageName = `photo.${fileExtension}`;
        const imagePath = `${uniqueFolderName}/${imageName}`;
        
        // 순서 계산
        const order = developersData.length;
        
        // JSON 데이터 생성
        const developerData = {
            name: name,
            type: 'developer',
            imageName: imageName,
            order: order,
            createdAt: new Date().toISOString()
        };
        
        // 이미지 업로드
        const imageUploadResult = await githubAPI.uploadImage('memory', imagePath, imageFile, `Add developer photo: ${name}`);
        if (!imageUploadResult.success) {
            throw new Error('이미지 업로드 실패: ' + imageUploadResult.error);
        }
        
        // JSON 파일 업로드
        const jsonPath = `${uniqueFolderName}/data.json`;
        const jsonContent = JSON.stringify(developerData, null, 2);
        const jsonUploadResult = await githubAPI.uploadFile('memory', jsonPath, jsonContent, `Add developer: ${name}`);
        
        if (jsonUploadResult.success) {
            alert('개발자가 성공적으로 추가되었습니다!');
            closeModal('developerModal');
            
            // 데이터 새로고침
            await loadDevelopers();
            displayDevelopers();
        } else {
            throw new Error(jsonUploadResult.error);
        }
        
        // 버튼 상태 복원
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
    } catch (error) {
        console.error('개발자 저장 실패:', error);
        alert('저장에 실패했습니다: ' + error.message);
        
        // 버튼 상태 복원
        const saveBtn = document.querySelector('#developerModal .save-btn');
        saveBtn.textContent = '저장';
        saveBtn.disabled = false;
    }
}

// 학생 수정
function editStudent(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    
    const newName = prompt('새로운 이름을 입력하세요:', student.name);
    if (newName && newName.trim() !== student.name) {
        updateStudentName(studentId, newName.trim());
    }
}

// 학생 이름 업데이트
async function updateStudentName(studentId, newName) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    
    try {
        // 기존 JSON 데이터 가져오기
        const jsonPath = `${student.folderPath}/data.json`;
        const jsonData = await githubAPI.downloadFile('memory', jsonPath);
        
        if (jsonData.success) {
            const studentData = JSON.parse(jsonData.content);
            studentData.name = newName;
            studentData.updatedAt = new Date().toISOString();
            
            // JSON 파일 업데이트
            const updatedJsonContent = JSON.stringify(studentData, null, 2);
            const updateResult = await githubAPI.uploadFile('memory', jsonPath, updatedJsonContent, `Update ${student.type}: ${newName}`);
            
            if (updateResult.success) {
                alert('이름이 성공적으로 수정되었습니다!');
                await loadStudents();
                displayStudents();
            } else {
                throw new Error(updateResult.error);
            }
        } else {
            throw new Error('기존 데이터를 불러올 수 없습니다.');
        }
    } catch (error) {
        console.error('학생 수정 실패:', error);
        alert('수정에 실패했습니다: ' + error.message);
    }
}

// 학생 삭제
async function deleteStudent(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    
    if (!confirm(`정말로 ${student.name}을(를) 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const deleteResult = await githubAPI.deleteFolder('memory', student.folderPath);
        
        if (deleteResult.success) {
            alert('성공적으로 삭제되었습니다.');
            await loadStudents();
            displayStudents();
        } else {
            throw new Error(deleteResult.error);
        }
    } catch (error) {
        console.error('학생 삭제 실패:', error);
        alert('삭제에 실패했습니다: ' + error.message);
    }
}

// 개발자 삭제
async function deleteDeveloper(developerId) {
    const developer = developersData.find(d => d.id === developerId);
    if (!developer) return;
    
    if (!confirm(`정말로 ${developer.name}을(를) 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const deleteResult = await githubAPI.deleteFolder('memory', developer.folderPath);
        
        if (deleteResult.success) {
            alert('성공적으로 삭제되었습니다.');
            await loadDevelopers();
            displayDevelopers();
        } else {
            throw new Error(deleteResult.error);
        }
    } catch (error) {
        console.error('개발자 삭제 실패:', error);
        alert('삭제에 실패했습니다: ' + error.message);
    }
}

// 학생 순서 변경
async function moveStudentUp(index) {
    if (index <= 0) return;
    
    const student = studentsData[index];
    const prevStudent = studentsData[index - 1];
    
    // 같은 타입끼리만 순서 변경 가능
    if (student.type !== prevStudent.type) return;
    
    await swapStudentOrder(student, prevStudent);
}

async function moveStudentDown(index) {
    if (index >= studentsData.length - 1) return;
    
    const student = studentsData[index];
    const nextStudent = studentsData[index + 1];
    
    // 같은 타입끼리만 순서 변경 가능
    if (student.type !== nextStudent.type) return;
    
    await swapStudentOrder(student, nextStudent);
}

// 학생 순서 교환
async function swapStudentOrder(student1, student2) {
    try {
        // 첫 번째 학생 데이터 업데이트
        const jsonPath1 = `${student1.folderPath}/data.json`;
        const jsonData1 = await githubAPI.downloadFile('memory', jsonPath1);
        
        if (jsonData1.success) {
            const data1 = JSON.parse(jsonData1.content);
            const tempOrder = data1.order;
            data1.order = student2.order;
            data1.updatedAt = new Date().toISOString();
            
            const updateResult1 = await githubAPI.uploadFile('memory', jsonPath1, JSON.stringify(data1, null, 2), `Update order: ${student1.name}`);
            
            if (updateResult1.success) {
                // 두 번째 학생 데이터 업데이트
                const jsonPath2 = `${student2.folderPath}/data.json`;
                const jsonData2 = await githubAPI.downloadFile('memory', jsonPath2);
                
                if (jsonData2.success) {
                    const data2 = JSON.parse(jsonData2.content);
                    data2.order = tempOrder;
                    data2.updatedAt = new Date().toISOString();
                    
                    const updateResult2 = await githubAPI.uploadFile('memory', jsonPath2, JSON.stringify(data2, null, 2), `Update order: ${student2.name}`);
                    
                    if (updateResult2.success) {
                        await loadStudents();
                        displayStudents();
                    } else {
                        throw new Error('두 번째 학생 순서 업데이트 실패');
                    }
                } else {
                    throw new Error('두 번째 학생 데이터 로드 실패');
                }
            } else {
                throw new Error('첫 번째 학생 순서 업데이트 실패');
            }
        } else {
            throw new Error('첫 번째 학생 데이터 로드 실패');
        }
    } catch (error) {
        console.error('순서 변경 실패:', error);
        alert('순서 변경에 실패했습니다: ' + error.message);
    }
}


// UI/UX 개선 기능들

// 토스트 알림 시스템
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션으로 표시
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// 빈 상태 표시
function showEmptyState(container, icon, title, description) {
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-${icon}"></i>
            <h3>${title}</h3>
            <p>${description}</p>
        </div>
    `;
}

// 스켈레톤 로딩 표시
function showSkeletonLoading(container, count = 3) {
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="memory-item">
                <div class="skeleton skeleton-text" style="width: 70%;"></div>
                <div class="skeleton skeleton-text" style="width: 50%;"></div>
                <div class="skeleton skeleton-text" style="width: 30%;"></div>
            </div>
        `;
    }
    container.innerHTML = skeletonHTML;
}

// 이미지 로딩 상태 관리
function handleImageLoad(img, fallbackSrc = null) {
    img.addEventListener('load', function() {
        this.style.opacity = '1';
    });
    
    img.addEventListener('error', function() {
        if (fallbackSrc) {
            this.src = fallbackSrc;
        } else {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPuydtOuvuOyngCDsl4bsnYw8L3RleHQ+Cjwvc3ZnPg==';
        }
        this.style.opacity = '1';
    });
}

// 프로그레스 바 업데이트
function updateProgress(percentage) {
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
}

// 개선된 추억 표시 함수
function displayMemories() {
    const container = document.getElementById('memoriesList');
    
    if (memoriesData.length === 0) {
        showEmptyState(
            container,
            'heart',
            '아직 추억이 없습니다',
            '첫 번째 추억을 작성해보세요!'
        );
        return;
    }
    
    container.innerHTML = '';
    
    memoriesData.forEach((memory, index) => {
        const memoryElement = document.createElement('div');
        memoryElement.className = 'memory-item fade-in';
        memoryElement.style.animationDelay = `${index * 0.1}s`;
        memoryElement.onclick = () => showMemoryDetail(memory);
        
        memoryElement.innerHTML = `
            <h3>${memory.title}</h3>
            <div class="memory-meta">
                <span><i class="fas fa-user"></i> ${memory.author}</span>
                <span><i class="fas fa-calendar"></i> ${memory.date}</span>
                <span><i class="fas fa-database"></i> ${memory.repository}</span>
            </div>
        `;
        
        container.appendChild(memoryElement);
    });
}

// 개선된 학생 표시 함수
function displayStudents() {
    const container = document.getElementById('studentsList');
    
    if (studentsData.length === 0) {
        showEmptyState(
            container,
            'users',
            '등록된 학생이 없습니다',
            '첫 번째 학생을 추가해보세요!'
        );
        return;
    }
    
    container.innerHTML = '';
    
    studentsData.forEach((student, index) => {
        const studentElement = document.createElement('div');
        studentElement.className = `student-item fade-in ${student.type === 'teacher' ? 'teacher' : ''}`;
        studentElement.style.animationDelay = `${index * 0.1}s`;
        
        const imagePath = `${student.folderPath}/${student.imageName}`;
        const imageUrl = githubAPI.getImageUrl('memory', imagePath);
        
        studentElement.innerHTML = `
            <img src="${imageUrl}" alt="${student.name}" class="student-image">
            <div class="student-name">${student.name}</div>
            <div class="student-actions">
                <button class="action-btn edit-btn" onclick="editStudent('${student.id}')">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="action-btn delete-btn" onclick="deleteStudent('${student.id}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
                <button class="action-btn move-btn" onclick="moveStudentUp(${index})" ${index === 0 || (index > 0 && studentsData[index-1].type !== student.type) ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="action-btn move-btn" onclick="moveStudentDown(${index})" ${index === studentsData.length - 1 || (index < studentsData.length - 1 && studentsData[index+1].type !== student.type) ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        `;
        
        // 이미지 로딩 처리
        const img = studentElement.querySelector('.student-image');
        handleImageLoad(img);
        
        container.appendChild(studentElement);
    });
}

// 개선된 개발자 표시 함수
function displayDevelopers() {
    const container = document.getElementById('developersList');
    
    if (developersData.length === 0) {
        showEmptyState(
            container,
            'code',
            '등록된 개발자가 없습니다',
            '첫 번째 개발자를 추가해보세요!'
        );
        return;
    }
    
    container.innerHTML = '';
    
    developersData.forEach((developer, index) => {
        const developerElement = document.createElement('div');
        developerElement.className = 'developer-item fade-in';
        developerElement.style.animationDelay = `${index * 0.1}s`;
        
        const imagePath = `${developer.folderPath}/${developer.imageName}`;
        const imageUrl = githubAPI.getImageUrl('memory', imagePath);
        
        developerElement.innerHTML = `
            <img src="${imageUrl}" alt="${developer.name}" class="developer-image">
            <div class="developer-name">${developer.name}</div>
            <div class="student-actions">
                <button class="action-btn delete-btn" onclick="deleteDeveloper('${developer.id}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        `;
        
        // 이미지 로딩 처리
        const img = developerElement.querySelector('.developer-image');
        handleImageLoad(img);
        
        container.appendChild(developerElement);
    });
}

// 개선된 에러 처리
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = '오류가 발생했습니다.';
    
    if (error.message) {
        if (error.message.includes('rate limit')) {
            message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('network')) {
            message = '네트워크 연결을 확인해주세요.';
        } else if (error.message.includes('unauthorized')) {
            message = '인증에 실패했습니다. 다시 로그인해주세요.';
        } else {
            message = error.message;
        }
    }
    
    showToast(message, 'error', 5000);
}

// 개선된 성공 메시지
function handleSuccess(message) {
    showToast(message, 'success', 3000);
}

// 로딩 상태 관리
function setLoadingState(element, isLoading, originalText = '') {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리 중...';
        element.classList.add('loading');
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || originalText;
        element.classList.remove('loading');
    }
}

// 개선된 저장 함수들 (에러 처리 및 사용자 피드백 개선)
async function saveMemory() {
    const title = document.getElementById('memoryTitle').value.trim();
    const author = document.getElementById('memoryAuthor').value.trim();
    const year = document.getElementById('memoryYear').value;
    const month = document.getElementById('memoryMonth').value;
    const day = document.getElementById('memoryDay').value;
    const repository = document.getElementById('memoryRepo').value;
    const images = document.getElementById('memoryImages').files;
    
    // 유효성 검사
    if (!title || !author || !year || !month || !day || !repository) {
        showToast('모든 필드를 입력해주세요.', 'warning');
        return;
    }
    
    // 날짜 유효성 검사
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() != year || date.getMonth() != month - 1 || date.getDate() != day) {
        showToast('올바른 날짜를 입력해주세요.', 'warning');
        return;
    }
    
    const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // 저장소 용량 체크
    const selectedRepo = repositoryData.find(repo => repo.name === repository);
    if (selectedRepo) {
        const capacityStatus = githubAPI.getRepositoryCapacityStatus(selectedRepo.size || 0);
        if (capacityStatus.status === 'danger') {
            showToast('선택한 저장소의 용량이 초과되었습니다. 다른 저장소를 선택해주세요.', 'error');
            return;
        }
    }
    
    const saveBtn = document.querySelector('#memoryModal .save-btn');
    
    try {
        setLoadingState(saveBtn, true);
        
        // 폴더명 생성
        const folderName = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const uniqueFolderName = `${folderName}_${timestamp}`;
        
        // JSON 데이터 생성
        const memoryData = {
            title: title,
            author: author,
            date: dateString,
            images: [],
            createdAt: new Date().toISOString()
        };
        
        // 이미지 업로드 (프로그레스 표시)
        if (images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const file = images[i];
                
                // 파일 크기 체크 (25MB)
                if (file.size > 25 * 1024 * 1024) {
                    showToast(`${file.name} 파일이 25MB를 초과합니다.`, 'warning');
                    continue;
                }
                
                const progress = ((i + 1) / images.length) * 80; // 80%까지는 이미지 업로드
                updateProgress(progress);
                
                const fileExtension = file.name.split('.').pop();
                const imageName = `image_${i + 1}.${fileExtension}`;
                const imagePath = `${uniqueFolderName}/${imageName}`;
                
                const uploadResult = await githubAPI.uploadImage(repository, imagePath, file, `Add image ${imageName} to ${title}`);
                if (uploadResult.success) {
                    memoryData.images.push(imageName);
                } else {
                    throw new Error(`이미지 업로드 실패: ${uploadResult.error}`);
                }
            }
        }
        
        updateProgress(90);
        
        // JSON 파일 업로드
        const jsonPath = `${uniqueFolderName}/data.json`;
        const jsonContent = JSON.stringify(memoryData, null, 2);
        const jsonUploadResult = await githubAPI.uploadFile(repository, jsonPath, jsonContent, `Add memory: ${title}`);
        
        if (jsonUploadResult.success) {
            updateProgress(100);
            handleSuccess('추억이 성공적으로 저장되었습니다!');
            closeModal('memoryModal');
            
            // 데이터 새로고침
            await loadMemories();
            displayMemories();
            
            // 저장소 정보 업데이트
            const repoCheck = await githubAPI.checkRepositories();
            if (repoCheck.success) {
                repositoryData = repoCheck.repositories;
                populateRepositoryOptions();
            }
        } else {
            throw new Error(jsonUploadResult.error);
        }
        
    } catch (error) {
        handleError(error, 'saveMemory');
    } finally {
        setLoadingState(saveBtn, false, '저장');
        updateProgress(0);
    }
}

// 키보드 단축키 지원
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter로 모달에서 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeModal = document.querySelector('.modal[style*="block"]');
        if (activeModal) {
            const saveBtn = activeModal.querySelector('.save-btn');
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            }
        }
    }
    
    // ESC로 모달 닫기
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal[style*="block"]');
        if (activeModal) {
            const modalId = activeModal.id;
            closeModal(modalId);
        }
    }
});

// 페이지 가시성 변경 시 데이터 새로고침
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && isLoggedIn) {
        // 페이지가 다시 보일 때 데이터 새로고침
        setTimeout(async () => {
            try {
                await loadAllData();
                displayMemories();
                displayStudents();
                displayDevelopers();
            } catch (error) {
                console.error('Data refresh failed:', error);
            }
        }, 1000);
    }
});

// 온라인/오프라인 상태 감지
window.addEventListener('online', function() {
    showToast('인터넷 연결이 복구되었습니다.', 'success');
});

window.addEventListener('offline', function() {
    showToast('인터넷 연결이 끊어졌습니다.', 'warning');
});

// 이미지 지연 로딩 (Intersection Observer)
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        }
    });
});

// 성능 모니터링
function logPerformance(action, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`${action} took ${duration.toFixed(2)} milliseconds`);
    
    if (duration > 1000) {
        console.warn(`Slow operation detected: ${action}`);
    }
}

