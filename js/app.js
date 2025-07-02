// 애플리케이션 상태 관리
const AppState = {
    isLoggedIn: false,
    currentTab: 'memories',
    students: [],
    developers: [],
    storageInfo: {}
};

// 전역 매니저 인스턴스들
let memoryManager;
let memoryUI;

// 화면 전환 함수들
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// 로그인 함수
async function login() {
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('loginError');
    
    if (password === '충상고스마트5기') {
        errorElement.textContent = '';
        showScreen('loadingScreen');
        
        try {
            await initializeApp();
            showScreen('mainScreen');
            AppState.isLoggedIn = true;
        } catch (error) {
            console.error('초기화 실패:', error);
            errorElement.textContent = '연결에 실패했습니다. 다시 시도해주세요.';
            showScreen('loginScreen');
        }
    } else {
        errorElement.textContent = '비밀번호가 올바르지 않습니다.';
    }
}

// 애플리케이션 초기화
async function initializeApp() {
    const statusElement = document.getElementById('loadingStatus');
    
    try {
        // 1. GitHub 연결 테스트
        statusElement.textContent = 'GitHub 연결 확인 중...';
        const connectionResults = await githubAPI.testConnections();
        
        // 2. 저장소 정보 업데이트
        statusElement.textContent = '저장소 정보 로딩 중...';
        AppState.storageInfo = connectionResults;
        updateStorageSelector();
        
        // 3. 매니저 인스턴스 초기화
        statusElement.textContent = '매니저 초기화 중...';
        memoryManager = new MemoryManager(githubAPI);
        memoryUI = new MemoryUI(memoryManager);
        
        // 4. 기존 데이터 로드
        statusElement.textContent = '기존 데이터 로딩 중...';
        await loadAllData();
        
        // 5. UI 업데이트
        statusElement.textContent = '화면 준비 중...';
        updateAllLists();
        
        statusElement.textContent = '완료!';
        
    } catch (error) {
        console.error('초기화 중 오류:', error);
        throw error;
    }
}

// 모든 데이터 로드
async function loadAllData() {
    try {
        // 추억 데이터 로드 (새로운 매니저 사용)
        await memoryManager.loadAllMemories();
        
        // 학생 데이터 로드
        AppState.students = [];
        try {
            const studentContents = await githubAPI.getFolderContents(GITHUB_CONFIG.specialRepo, 'students');
            for (const item of studentContents) {
                if (item.type === 'dir') {
                    const studentData = await githubAPI.loadJSON(GITHUB_CONFIG.specialRepo, `students/${item.name}/data.json`);
                    if (studentData) {
                        studentData.id = item.name;
                        AppState.students.push(studentData);
                    }
                }
            }
        } catch (error) {
            console.error('학생 데이터 로드 실패:', error);
        }
        
        // 개발자 데이터 로드
        AppState.developers = [];
        try {
            const developerContents = await githubAPI.getFolderContents(GITHUB_CONFIG.specialRepo, 'developers');
            for (const item of developerContents) {
                if (item.type === 'dir') {
                    const developerData = await githubAPI.loadJSON(GITHUB_CONFIG.specialRepo, `developers/${item.name}/data.json`);
                    if (developerData) {
                        developerData.id = item.name;
                        AppState.developers.push(developerData);
                    }
                }
            }
        } catch (error) {
            console.error('개발자 데이터 로드 실패:', error);
        }
        
        // 데이터 정렬
        AppState.students.sort((a, b) => a.order - b.order);
        AppState.developers.sort((a, b) => a.order - b.order);
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        throw error;
    }
}

// 탭 전환
function showTab(tabName) {
    // 탭 버튼 업데이트
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 탭 콘텐츠 업데이트
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    AppState.currentTab = tabName;
}

// 저장소 선택기 업데이트
function updateStorageSelector() {
    const selector = document.getElementById('memoryStorage');
    selector.innerHTML = '<option value="">저장소를 선택하세요</option>';
    
    GITHUB_CONFIG.repositories.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo;
        option.textContent = repo;
        selector.appendChild(option);
    });
    
    // 저장소 변경 이벤트 리스너
    selector.addEventListener('change', updateStorageInfo);
}

// 저장소 정보 업데이트
async function updateStorageInfo() {
    const selector = document.getElementById('memoryStorage');
    const infoElement = document.getElementById('storageInfo');
    const selectedRepo = selector.value;
    
    if (!selectedRepo) {
        infoElement.innerHTML = '';
        return;
    }
    
    try {
        const size = await githubAPI.getRepositorySize(selectedRepo);
        const formattedSize = formatFileSize(size);
        
        if (isStorageNearFull(size)) {
            infoElement.innerHTML = `<span style="color: red;">용량: ${formattedSize} - 다른 저장소를 선택해주세요</span>`;
            infoElement.className = 'storage-info error';
        } else {
            infoElement.innerHTML = `용량: ${formattedSize}`;
            infoElement.className = 'storage-info';
        }
    } catch (error) {
        infoElement.innerHTML = '저장소 정보를 가져올 수 없습니다.';
        infoElement.className = 'storage-info error';
    }
}

// 추억 관련 함수들
function showMemoryForm() {
    document.getElementById('memoryForm').classList.remove('hidden');
}

function hideMemoryForm() {
    document.getElementById('memoryForm').classList.add('hidden');
    clearMemoryForm();
}

function clearMemoryForm() {
    document.getElementById('memoryYear').value = '';
    document.getElementById('memoryMonth').value = '';
    document.getElementById('memoryDay').value = '';
    document.getElementById('memoryStorage').value = '';
    document.getElementById('memoryAuthor').value = '';
    document.getElementById('memoryTitle').value = '';
    document.getElementById('memoryImage').value = '';
    document.getElementById('storageInfo').innerHTML = '';
}

async function addMemory() {
    const year = document.getElementById('memoryYear').value;
    const month = document.getElementById('memoryMonth').value.padStart(2, '0');
    const day = document.getElementById('memoryDay').value.padStart(2, '0');
    const storage = document.getElementById('memoryStorage').value;
    const author = document.getElementById('memoryAuthor').value;
    const title = document.getElementById('memoryTitle').value;
    const imageFile = document.getElementById('memoryImage').files[0];
    
    // 유효성 검사
    if (!year || !month || !day || !storage || !author || !title) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    if (imageFile && !validateFileSize(imageFile)) {
        alert('이미지 파일은 25MB 이하여야 합니다.');
        return;
    }
    
    // 저장소 용량 확인
    const storageSize = await githubAPI.getRepositorySize(storage);
    if (isStorageNearFull(storageSize)) {
        alert('선택한 저장소의 용량이 부족합니다. 다른 저장소를 선택해주세요.');
        return;
    }
    
    try {
        const date = `${year}-${month}-${day}`;
        const folderId = sanitizeFileName(title) + '_' + generateUniqueId();
        
        // JSON 데이터 생성
        const memoryData = {
            title,
            author,
            date,
            hasImage: !!imageFile,
            imageFileName: imageFile ? imageFile.name : null,
            createdAt: new Date().toISOString()
        };
        
        // GitHub에 저장
        await githubAPI.saveJSON(storage, `${folderId}/data.json`, memoryData, `Add memory: ${title}`);
        
        // 이미지 업로드
        if (imageFile) {
            const imageExtension = imageFile.name.split('.').pop();
            await githubAPI.uploadBinaryFile(storage, `${folderId}/image.${imageExtension}`, imageFile, `Add image for: ${title}`);
        }
        
        // 로컬 상태 업데이트
        memoryData.id = folderId;
        memoryData.repository = storage;
        AppState.memories.push(memoryData);
        AppState.memories.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // UI 업데이트
        updateMemoriesList();
        hideMemoryForm();
        
        alert('추억이 성공적으로 추가되었습니다!');
        
    } catch (error) {
        console.error('추억 추가 실패:', error);
        alert('추억 추가에 실패했습니다. 다시 시도해주세요.');
    }
}

function updateStudentsList() {
    const container = document.getElementById('studentsList');
    container.innerHTML = '';
    
    if (AppState.students.length === 0) {
        container.innerHTML = '<div class="no-content">아직 등록된 학생이 없습니다. 첫 번째 학생을 등록해보세요!</div>';
        return;
    }
    
    // 선생님 먼저, 그 다음 학생
    const teachers = AppState.students.filter(s => s.type === 'teacher');
    const students = AppState.students.filter(s => s.type === 'student');
    
    [...teachers, ...students].forEach(student => {
        const studentElement = createStudentElement(student);
        container.appendChild(studentElement);
    });
}

function updateDevelopersList() {
    const container = document.getElementById('developersList');
    container.innerHTML = '';
    
    if (AppState.developers.length === 0) {
        container.innerHTML = '<div class="no-content">아직 등록된 개발자가 없습니다. 첫 번째 개발자를 등록해보세요!</div>';
        return;
    }
    
    AppState.developers.forEach(developer => {
        const developerElement = createDeveloperElement(developer);
        container.appendChild(developerElement);
    });
}

// 요소 생성 함수들 (이미지 클릭 기능 추가)
function createMemoryElement(memory) {
    const div = document.createElement('div');
    div.className = 'memory-item fade-in';
    div.setAttribute('data-memory-id', memory.id);

    const imageUrl = memory.hasImage ? 
        `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${memory.repository}/main/${memory.id}/image.${memory.imageFileName.split('.').pop()}` : '';

    div.innerHTML = `
        <h3>${escapeHtml(memory.title)}</h3>
        <div class="memory-meta">
            <span class="author">${escapeHtml(memory.author)}</span> • 
            <span class="date">${memory.date}</span> • 
            <span class="repository">${memory.repository}</span>
        </div>
        ${memory.hasImage ? `<img src="${imageUrl}" alt="${escapeHtml(memory.title)}" class="memory-image" loading="lazy" onclick="showImageModal('${imageUrl}', '${escapeHtml(memory.title)}')" onerror="handleImageError(this)">` : ''}
        <div class="item-actions">
            <button class="edit-btn" onclick="memoryUI.showEditModal('${memory.id}')">수정</button>
            <button class="delete-btn" onclick="memoryUI.confirmDelete('${memory.id}')">삭제</button>
        </div>
    `;

    return div;
}

function createStudentElement(student) {
    const div = document.createElement('div');
    div.className = 'student-item fade-in';
    
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.specialRepo}/main/students/${student.id}/image.${student.imageFileName.split('.').pop()}`;
    
    div.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHtml(student.name)}" class="student-image ${student.type}" loading="lazy" onclick="showImageModal('${imageUrl}', '${escapeHtml(student.name)}')" onerror="handleImageError(this)">
        <h3>${escapeHtml(student.name)} ${student.type === 'teacher' ? '(선생님)' : '(학생)'}</h3>
        <div class="item-actions">
            <button class="edit-btn" onclick="editStudent('${student.id}')">수정</button>
            <button class="delete-btn" onclick="deleteStudent('${student.id}')">삭제</button>
            <button class="move-btn" onclick="moveStudent('${student.id}', 'up')" title="위로 이동">⬆</button>
            <button class="move-btn" onclick="moveStudent('${student.id}', 'down')" title="아래로 이동">⬇</button>
        </div>
    `;
    
    return div;
}

function createDeveloperElement(developer) {
    const div = document.createElement('div');
    div.className = 'developer-item fade-in';
    
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.specialRepo}/main/developers/${developer.id}/image.${developer.imageFileName.split('.').pop()}`;
    
    div.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHtml(developer.name)}" class="developer-image" loading="lazy" onclick="showImageModal('${imageUrl}', '${escapeHtml(developer.name)}')" onerror="handleImageError(this)">
        <h3>${escapeHtml(developer.name)}</h3>
        <div class="item-actions">
            <button class="delete-btn" onclick="deleteDeveloper('${developer.id}')">삭제</button>
        </div>
    `;
    
    return div;
}

// 이미지 모달 표시
function showImageModal(imageUrl, title) {
    // 기존 모달 제거
    const existingModal = document.querySelector('.image-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // 새 모달 생성
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <span class="close-btn" onclick="closeImageModal()">&times;</span>
        <img src="${imageUrl}" alt="${title}" onclick="event.stopPropagation()">
    `;

    // 모달 클릭 시 닫기
    modal.addEventListener('click', closeImageModal);

    // ESC 키로 닫기
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeImageModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(modal);
}

// 이미지 모달 닫기
function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        modal.remove();
    }
}

// 이미지 로딩 에러 처리
function handleImageError(img) {
    img.style.display = 'none';
    
    // 에러 메시지 요소 생성
    const errorDiv = document.createElement('div');
    errorDiv.className = 'image-error';
    errorDiv.style.height = img.style.minHeight || '200px';
    errorDiv.textContent = '이미지를 불러올 수 없습니다';
    
    // 이미지 요소 다음에 에러 메시지 삽입
    img.parentNode.insertBefore(errorDiv, img.nextSibling);
}

// 삭제 함수들
async function deleteStudent(studentId) {
    if (!confirm('정말로 이 학생을 삭제하시겠습니까?')) return;
    
    try {
        // GitHub에서 폴더 삭제
        await githubAPI.deleteFolder(GITHUB_CONFIG.specialRepo, `students/${studentId}`);
        
        // 로컬 상태 업데이트
        AppState.students = AppState.students.filter(s => s.id !== studentId);
        updateStudentsList();
        
        showNotification('학생이 삭제되었습니다.', 'success');
        
    } catch (error) {
        console.error('학생 삭제 실패:', error);
        alert('학생 삭제에 실패했습니다: ' + error.message);
    }
}

async function deleteDeveloper(developerId) {
    if (!confirm('정말로 이 개발자를 삭제하시겠습니까?')) return;
    
    try {
        // GitHub에서 폴더 삭제
        await githubAPI.deleteFolder(GITHUB_CONFIG.specialRepo, `developers/${developerId}`);
        
        // 로컬 상태 업데이트
        AppState.developers = AppState.developers.filter(d => d.id !== developerId);
        updateDevelopersList();
        
        showNotification('개발자가 삭제되었습니다.', 'success');
        
    } catch (error) {
        console.error('개발자 삭제 실패:', error);
        alert('개발자 삭제에 실패했습니다: ' + error.message);
    }
}

// 수정 및 이동 함수들 (완전 구현)
async function editStudent(studentId) {
    const student = AppState.students.find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('editModal');
    const modalContent = document.getElementById('editModalContent');

    modalContent.innerHTML = `
        <h3>학생 정보 수정</h3>
        <div class="form-group">
            <label>이름</label>
            <input type="text" id="editStudentName" value="${escapeHtml(student.name)}">
        </div>
        <div class="form-group">
            <label>구분</label>
            <select id="editStudentType">
                <option value="student" ${student.type === 'student' ? 'selected' : ''}>학생</option>
                <option value="teacher" ${student.type === 'teacher' ? 'selected' : ''}>선생님</option>
            </select>
        </div>
        <div class="form-group">
            <label>새 사진 (선택사항)</label>
            <input type="file" id="editStudentImage" accept="image/*">
            <small>새 사진을 선택하지 않으면 기존 사진이 유지됩니다.</small>
        </div>
        <div class="form-actions">
            <button onclick="saveStudentEdit('${studentId}')">저장</button>
            <button onclick="closeEditModal()">취소</button>
        </div>
    `;

    modal.classList.remove('hidden');
}

async function saveStudentEdit(studentId) {
    const name = document.getElementById('editStudentName').value.trim();
    const type = document.getElementById('editStudentType').value;
    const imageFile = document.getElementById('editStudentImage').files[0];

    if (!name) {
        alert('이름을 입력해주세요.');
        return;
    }

    if (imageFile && !validateFileSize(imageFile)) {
        alert('이미지 파일은 25MB 이하여야 합니다.');
        return;
    }

    try {
        const student = AppState.students.find(s => s.id === studentId);
        const updatedData = {
            ...student,
            name,
            type,
            updatedAt: new Date().toISOString()
        };

        // 새 이미지가 있으면 업로드
        if (imageFile) {
            const imageExtension = imageFile.name.split('.').pop();
            await githubAPI.uploadBinaryFile(
                GITHUB_CONFIG.specialRepo, 
                `students/${studentId}/image.${imageExtension}`, 
                imageFile, 
                `Update image for: ${name}`
            );
            updatedData.imageFileName = imageFile.name;
        }

        // JSON 데이터 업데이트
        await githubAPI.saveJSON(
            GITHUB_CONFIG.specialRepo, 
            `students/${studentId}/data.json`, 
            updatedData, 
            `Update student: ${name}`
        );

        // 로컬 상태 업데이트
        const index = AppState.students.findIndex(s => s.id === studentId);
        AppState.students[index] = updatedData;

        updateStudentsList();
        closeEditModal();
        showNotification('학생 정보가 수정되었습니다!', 'success');

    } catch (error) {
        console.error('학생 수정 실패:', error);
        alert('학생 수정에 실패했습니다: ' + error.message);
    }
}

async function moveStudent(studentId, direction) {
    const currentIndex = AppState.students.findIndex(s => s.id === studentId);
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'up') {
        newIndex = Math.max(0, currentIndex - 1);
    } else {
        newIndex = Math.min(AppState.students.length - 1, currentIndex + 1);
    }

    if (newIndex === currentIndex) return; // 이동할 곳이 없음

    try {
        // 배열에서 순서 변경
        const [movedStudent] = AppState.students.splice(currentIndex, 1);
        AppState.students.splice(newIndex, 0, movedStudent);

        // 모든 학생의 order 값 업데이트
        for (let i = 0; i < AppState.students.length; i++) {
            AppState.students[i].order = i;
            await githubAPI.saveJSON(
                GITHUB_CONFIG.specialRepo,
                `students/${AppState.students[i].id}/data.json`,
                AppState.students[i],
                `Update order for: ${AppState.students[i].name}`
            );
        }

        updateStudentsList();
        showNotification('순서가 변경되었습니다!', 'success');

    } catch (error) {
        console.error('순서 변경 실패:', error);
        alert('순서 변경에 실패했습니다: ' + error.message);
    }
}

// 모달 관련 함수들
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

// 유틸리티 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI 업데이트 함수들
function updateAllLists() {
    updateMemoriesList();
    updateStudentsList();
    updateDevelopersList();
}

function updateMemoriesList() {
    if (memoryUI) {
        memoryUI.renderMemoriesList();
    }
}

// 추억 관련 함수들 (새로운 매니저 사용)
function showMemoryForm() {
    document.getElementById('memoryForm').classList.remove('hidden');
}

function hideMemoryForm() {
    document.getElementById('memoryForm').classList.add('hidden');
    clearMemoryForm();
}

function clearMemoryForm() {
    document.getElementById('memoryYear').value = '';
    document.getElementById('memoryMonth').value = '';
    document.getElementById('memoryDay').value = '';
    document.getElementById('memoryStorage').value = '';
    document.getElementById('memoryAuthor').value = '';
    document.getElementById('memoryTitle').value = '';
    document.getElementById('memoryImage').value = '';
    document.getElementById('storageInfo').innerHTML = '';
}

async function addMemory() {
    const year = document.getElementById('memoryYear').value;
    const month = document.getElementById('memoryMonth').value.padStart(2, '0');
    const day = document.getElementById('memoryDay').value.padStart(2, '0');
    const repository = document.getElementById('memoryStorage').value;
    const author = document.getElementById('memoryAuthor').value.trim();
    const title = document.getElementById('memoryTitle').value.trim();
    const imageFile = document.getElementById('memoryImage').files[0];
    
    // 유효성 검사
    if (!year || !month || !day || !repository || !author || !title) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    try {
        const memoryData = {
            title,
            author,
            date: `${year}-${month}-${day}`,
            repository
        };

        await memoryManager.addMemory(memoryData, imageFile);
        updateMemoriesList();
        hideMemoryForm();
        
        showNotification('추억이 성공적으로 추가되었습니다!', 'success');
        
    } catch (error) {
        console.error('추억 추가 실패:', error);
        alert('추억 추가에 실패했습니다: ' + error.message);
    }
}
// 학생 관련 함수들
function showStudentForm() {
    document.getElementById('studentForm').classList.remove('hidden');
}

function hideStudentForm() {
    document.getElementById('studentForm').classList.add('hidden');
    clearStudentForm();
}

function clearStudentForm() {
    document.getElementById('studentName').value = '';
    document.getElementById('studentType').value = 'student';
    document.getElementById('studentImage').value = '';
}

async function addStudent() {
    const name = document.getElementById('studentName').value.trim();
    const type = document.getElementById('studentType').value;
    const imageFile = document.getElementById('studentImage').files[0];
    
    if (!name || !imageFile) {
        alert('이름과 사진을 모두 입력해주세요.');
        return;
    }
    
    if (!validateFileSize(imageFile)) {
        alert('이미지 파일은 25MB 이하여야 합니다.');
        return;
    }
    
    try {
        const folderId = sanitizeFileName(name) + '_' + generateUniqueId();
        const order = AppState.students.length;
        
        const studentData = {
            name,
            type,
            order,
            imageFileName: imageFile.name,
            createdAt: new Date().toISOString()
        };
        
        // GitHub에 저장
        await githubAPI.saveJSON(GITHUB_CONFIG.specialRepo, `students/${folderId}/data.json`, studentData, `Add student: ${name}`);
        
        const imageExtension = imageFile.name.split('.').pop();
        await githubAPI.uploadBinaryFile(GITHUB_CONFIG.specialRepo, `students/${folderId}/image.${imageExtension}`, imageFile, `Add image for: ${name}`);
        
        // 로컬 상태 업데이트
        studentData.id = folderId;
        AppState.students.push(studentData);
        AppState.students.sort((a, b) => a.order - b.order);
        
        // UI 업데이트
        updateStudentsList();
        hideStudentForm();
        
        showNotification('학생이 성공적으로 추가되었습니다!', 'success');
        
    } catch (error) {
        console.error('학생 추가 실패:', error);
        alert('학생 추가에 실패했습니다: ' + error.message);
    }
}

// 개발자 관련 함수들
function showDeveloperForm() {
    document.getElementById('developerForm').classList.remove('hidden');
}

function hideDeveloperForm() {
    document.getElementById('developerForm').classList.add('hidden');
    clearDeveloperForm();
}

function clearDeveloperForm() {
    document.getElementById('developerName').value = '';
    document.getElementById('developerImage').value = '';
}

async function addDeveloper() {
    const name = document.getElementById('developerName').value.trim();
    const imageFile = document.getElementById('developerImage').files[0];
    
    if (!name || !imageFile) {
        alert('이름과 사진을 모두 입력해주세요.');
        return;
    }
    
    if (!validateFileSize(imageFile)) {
        alert('이미지 파일은 25MB 이하여야 합니다.');
        return;
    }
    
    try {
        const folderId = sanitizeFileName(name) + '_' + generateUniqueId();
        const order = AppState.developers.length;
        
        const developerData = {
            name,
            order,
            imageFileName: imageFile.name,
            createdAt: new Date().toISOString()
        };
        
        // GitHub에 저장
        await githubAPI.saveJSON(GITHUB_CONFIG.specialRepo, `developers/${folderId}/data.json`, developerData, `Add developer: ${name}`);
        
        const imageExtension = imageFile.name.split('.').pop();
        await githubAPI.uploadBinaryFile(GITHUB_CONFIG.specialRepo, `developers/${folderId}/image.${imageExtension}`, imageFile, `Add image for: ${name}`);
        
        // 로컬 상태 업데이트
        developerData.id = folderId;
        AppState.developers.push(developerData);
        AppState.developers.sort((a, b) => a.order - b.order);
        
        // UI 업데이트
        updateDevelopersList();
        hideDeveloperForm();
        
        showNotification('개발자가 성공적으로 추가되었습니다!', 'success');
        
    } catch (error) {
        console.error('개발자 추가 실패:', error);
        alert('개발자 추가에 실패했습니다: ' + error.message);
    }
}


// 알림 시스템
function showNotification(message, type = 'success') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 애니메이션 트리거
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// 유틸리티 함수들
function validateFileSize(file) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    return file.size <= maxSize;
}

function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 50);
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isStorageNearFull(sizeInBytes) {
    const maxSize = 800 * 1024 * 1024; // 800MB
    return sizeInBytes >= maxSize;
}

// 저장소 선택 업데이트
function updateStorageSelector() {
    const selector = document.getElementById('memoryStorage');
    if (!selector) return;
    
    // 기존 옵션 제거 (첫 번째 옵션 제외)
    while (selector.children.length > 1) {
        selector.removeChild(selector.lastChild);
    }
    
    // 저장소 옵션 추가
    GITHUB_CONFIG.repositories.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo;
        option.textContent = repo;
        selector.appendChild(option);
    });
}

// 저장소 정보 표시
async function updateStorageInfo() {
    const selector = document.getElementById('memoryStorage');
    const infoDiv = document.getElementById('storageInfo');
    
    if (!selector || !infoDiv) return;
    
    const selectedRepo = selector.value;
    if (!selectedRepo || selectedRepo === '') {
        infoDiv.innerHTML = '';
        return;
    }
    
    try {
        const size = await githubAPI.getRepositorySize(selectedRepo);
        const sizeText = formatFileSize(size);
        
        if (isStorageNearFull(size)) {
            infoDiv.className = 'storage-info error';
            infoDiv.innerHTML = `⚠️ 저장소 용량: ${sizeText} (용량 부족 - 다른 저장소를 선택하세요)`;
        } else if (size > 500 * 1024 * 1024) { // 500MB 이상
            infoDiv.className = 'storage-info warning';
            infoDiv.innerHTML = `⚠️ 저장소 용량: ${sizeText} (용량 주의)`;
        } else {
            infoDiv.className = 'storage-info';
            infoDiv.innerHTML = `✅ 저장소 용량: ${sizeText} (여유 공간 충분)`;
        }
    } catch (error) {
        infoDiv.className = 'storage-info error';
        infoDiv.innerHTML = '❌ 저장소 정보를 가져올 수 없습니다.';
    }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 저장소 선택 변경 시 정보 업데이트
    const storageSelector = document.getElementById('memoryStorage');
    if (storageSelector) {
        storageSelector.addEventListener('change', updateStorageInfo);
    }
    
    // 파일 입력 변경 시 크기 검증
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && !validateFileSize(file)) {
                showNotification('파일 크기는 25MB 이하여야 합니다.', 'error');
                e.target.value = '';
            }
        });
    });
    
    // 엔터 키로 로그인
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
});

// 페이지 로드 완료 시 초기화
window.addEventListener('load', function() {
    // 초기 화면 설정
    showScreen('loginScreen');
    
    // 서비스 워커 등록 (PWA 지원)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function(error) {
            console.log('Service Worker 등록 실패:', error);
        });
    }
});

// 오프라인 감지
window.addEventListener('online', function() {
    showNotification('인터넷 연결이 복구되었습니다.', 'success');
});

window.addEventListener('offline', function() {
    showNotification('인터넷 연결이 끊어졌습니다.', 'error');
});

// 에러 핸들링
window.addEventListener('error', function(e) {
    console.error('전역 에러:', e.error);
    showNotification('예상치 못한 오류가 발생했습니다.', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('처리되지 않은 Promise 거부:', e.reason);
    showNotification('네트워크 오류가 발생했습니다.', 'error');
});

