class DevelopersManager {
    constructor() {
        this.developers = [];
        this.editingDeveloper = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 추가 버튼 이벤트
        document.getElementById('add-developer-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 폼 제출 이벤트
        document.getElementById('developer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingDeveloper) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        // 삭제 버튼 이벤트
        document.getElementById('developer-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        // 이미지 미리보기
        document.getElementById('developer-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingDeveloper = null;
        window.uiManager.showModal('developer-modal', '개발자 추가');
    }

    showEditModal(developer) {
        this.editingDeveloper = developer;
        window.uiManager.showModal('developer-modal', '개발자 수정');

        // 폼에 데이터 채우기
        document.getElementById('developer-name').value = developer.name;

        // 이미지 미리보기 설정
        const previewContainer = document.getElementById('developer-image-preview');
        previewContainer.innerHTML = '';
        
        if (developer.imagePath) {
            const img = document.createElement('img');
            img.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${developer.imagePath}`;
            previewContainer.appendChild(img);
        }

        // 파일 입력 라벨 변경
        const fileLabel = document.querySelector('label[for="developer-image"]');
        fileLabel.textContent = '사진 변경 (최대 10MB)';

        // 삭제 버튼 표시
        document.getElementById('developer-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#developer-form button[type="submit"]').textContent = '수정';
    }

    async handleAdd() {
        try {
            const name = document.getElementById('developer-name').value.trim();
            const imageFile = document.getElementById('developer-image').files[0];

            if (!name || !imageFile) {
                alert('모든 필드를 입력해주세요.');
                return;
            }

            // 이미지 크기 확인 (10MB 제한)
            if (imageFile.size > 10 * 1024 * 1024) {
                alert('이미지 크기는 10MB를 초과할 수 없습니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#developer-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 확장자 추출
            const imageExtension = imageFile.name.split('.').pop().toLowerCase();
            
            // 이미지 Base64로 변환
            const imageBase64 = await this.readFileAsBase64(imageFile);
            
            // 이미지 업로드
            const imagePath = `개발자/${folderName}/image.${imageExtension}`;
            await window.githubAPI.uploadImage(imagePath, imageBase64, `Add developer image: ${name}`);
            
            // 개발자 데이터 생성
            const developer = {
                name,
                imagePath,
                order: this.getNextOrder(),
                createdAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `개발자/${folderName}/data.json`,
                JSON.stringify(developer, null, 2),
                `Add developer data: ${name}`
            );
            
            // 개발자 목록에 추가
            this.developers.push(developer);
            
            // UI 업데이트
            this.renderDevelopers();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('개발자가 추가되었습니다.', 'success');
        } catch (error) {
            console.error('개발자 추가 오류:', error);
            alert('개발자를 추가하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#developer-form button[type="submit"]');
            submitBtn.textContent = '추가';
            submitBtn.disabled = false;
        }
    }

    async handleUpdate() {
        try {
            const name = document.getElementById('developer-name').value.trim();
            const imageFile = document.getElementById('developer-image').files[0];

            if (!name) {
                alert('이름은 필수 입력 항목입니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#developer-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 기존 폴더명
            const oldFolderName = window.githubAPI.sanitizeFolderName(this.editingDeveloper.name);
            
            // 새 폴더명
            const newFolderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 경로 설정
            let imagePath = this.editingDeveloper.imagePath;
            
            // 이미지가 변경된 경우
            if (imageFile) {
                // 이미지 크기 확인 (10MB 제한)
                if (imageFile.size > 10 * 1024 * 1024) {
                    alert('이미지 크기는 10MB를 초과할 수 없습니다.');
                    return;
                }
                
                // 이미지 확장자 추출
                const imageExtension = imageFile.name.split('.').pop().toLowerCase();
                
                // 이미지 Base64로 변환
                const imageBase64 = await this.readFileAsBase64(imageFile);
                
                // 이미지 업로드 (폴더명이 변경된 경우 새 경로에 업로드)
                imagePath = `개발자/${newFolderName}/image.${imageExtension}`;
                await window.githubAPI.uploadImage(imagePath, imageBase64, `Update developer image: ${name}`);
            } 
            // 폴더명이 변경된 경우에만 이미지 경로 업데이트
            else if (oldFolderName !== newFolderName && this.editingDeveloper.imagePath) {
                // 이미지 확장자 추출
                const imageExtension = this.editingDeveloper.imagePath.split('.').pop();
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(this.editingDeveloper.imagePath);
                
                if (oldImageContent) {
                    // 새 경로에 이미지 업로드
                    imagePath = `개발자/${newFolderName}/image.${imageExtension}`;
                    await window.githubAPI.uploadImage(imagePath, oldImageContent, `Move developer image: ${name}`);
                }
            }
            
            // 개발자 데이터 업데이트
            const updatedDeveloper = {
                ...this.editingDeveloper,
                name,
                imagePath,
                updatedAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `개발자/${newFolderName}/data.json`,
                JSON.stringify(updatedDeveloper, null, 2),
                `Update developer data: ${name}`
            );
            
            // 개발자 목록 업데이트
            const index = this.developers.findIndex(d => 
                d.name === this.editingDeveloper.name
            );
            
            if (index !== -1) {
                this.developers[index] = updatedDeveloper;
            }
            
            // UI 업데이트
            this.renderDevelopers();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('개발자 정보가 수정되었습니다.', 'success');
        } catch (error) {
            console.error('개발자 수정 오류:', error);
            alert('개발자 정보를 수정하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#developer-form button[type="submit"]');
            submitBtn.textContent = '수정';
            submitBtn.disabled = false;
        }
    }

    async handleDelete() {
        if (!this.editingDeveloper) return;
        
        if (!confirm('정말로 이 개발자를 삭제하시겠습니까?')) {
            return;
        }
        
        try {
            // 로딩 상태 표시
            const deleteBtn = document.getElementById('developer-delete');
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = '삭제 중...';
            deleteBtn.disabled = true;
            
            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(this.editingDeveloper.name);
            
            // 폴더 삭제
            await window.githubAPI.deleteFolder(`개발자/${folderName}`);
            
            // 개발자 목록에서 제거
            this.developers = this.developers.filter(d => 
                d.name !== this.editingDeveloper.name
            );
            
            // UI 업데이트
            this.renderDevelopers();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('개발자가 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('개발자 삭제 오류:', error);
            alert('개발자를 삭제하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const deleteBtn = document.getElementById('developer-delete');
            deleteBtn.textContent = '삭제';
            deleteBtn.disabled = false;
        }
    }

    handleImagePreview(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 이미지 크기 확인 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
            alert('이미지 크기는 10MB를 초과할 수 없습니다.');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const previewContainer = document.getElementById('developer-image-preview');
            previewContainer.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async moveDeveloperUp(developer) {
        try {
            // 개발자들 순서대로 정렬
            const sortedDevelopers = [...this.developers].sort((a, b) => a.order - b.order);
            
            // 현재 개발자의 인덱스 찾기
            const currentIndex = sortedDevelopers.findIndex(d => d.name === developer.name);
            
            // 이미 맨 위에 있는 경우
            if (currentIndex === 0) {
                window.uiManager.showNotification('이미 맨 위에 있습니다.', 'info');
                return;
            }
            
            // 위에 있는 개발자와 순서 교환
            const prevDeveloper = sortedDevelopers[currentIndex - 1];
            const tempOrder = developer.order;
            
            // 순서 업데이트
            developer.order = prevDeveloper.order;
            prevDeveloper.order = tempOrder;
            
            // 두 개발자의 데이터 업데이트
            await this.updateDeveloperData(developer);
            await this.updateDeveloperData(prevDeveloper);
            
            // UI 업데이트
            this.renderDevelopers();
            
            // 알림 표시
            window.uiManager.showNotification('개발자 순서가 변경되었습니다.', 'success');
        } catch (error) {
            console.error('개발자 순서 변경 오류:', error);
            alert('개발자 순서를 변경하는 중 오류가 발생했습니다.');
        }
    }

    async moveDeveloperDown(developer) {
        try {
            // 개발자들 순서대로 정렬
            const sortedDevelopers = [...this.developers].sort((a, b) => a.order - b.order);
            
            // 현재 개발자의 인덱스 찾기
            const currentIndex = sortedDevelopers.findIndex(d => d.name === developer.name);
            
            // 이미 맨 아래에 있는 경우
            if (currentIndex === sortedDevelopers.length - 1) {
                window.uiManager.showNotification('이미 맨 아래에 있습니다.', 'info');
                return;
            }
            
            // 아래에 있는 개발자와 순서 교환
            const nextDeveloper = sortedDevelopers[currentIndex + 1];
            const tempOrder = developer.order;
            
            // 순서 업데이트
            developer.order = nextDeveloper.order;
            nextDeveloper.order = tempOrder;
            
            // 두 개발자의 데이터 업데이트
            await this.updateDeveloperData(developer);
            await this.updateDeveloperData(nextDeveloper);
            
            // UI 업데이트
            this.renderDevelopers();
            
            // 알림 표시
            window.uiManager.showNotification('개발자 순서가 변경되었습니다.', 'success');
        } catch (error) {
            console.error('개발자 순서 변경 오류:', error);
            alert('개발자 순서를 변경하는 중 오류가 발생했습니다.');
        }
    }

    async updateDeveloperData(developer) {
        // 폴더명 생성
        const folderName = window.githubAPI.sanitizeFolderName(developer.name);
        
        // JSON 파일 업로드
        await window.githubAPI.uploadFile(
            `개발자/${folderName}/data.json`,
            JSON.stringify(developer, null, 2),
            `Update developer order: ${developer.name}`
        );
    }

    getNextOrder() {
        // 개발자들 순서대로 정렬
        const sortedDevelopers = [...this.developers].sort((a, b) => a.order - b.order);
        
        // 마지막 개발자의 순서 + 1 또는 0
        return sortedDevelopers.length > 0 ? sortedDevelopers[sortedDevelopers.length - 1].order + 1 : 0;
    }

    async loadDevelopers() {
        try {
            // 개발자 폴더 내용 가져오기
            const contents = await window.githubAPI.listFolderContents('개발자');
            
            // 폴더만 필터링
            const folders = contents.filter(item => item.type === 'dir');
            
            this.developers = [];
            
            // 각 폴더에서 data.json 파일 가져오기
            for (const folder of folders) {
                try {
                    const dataContent = await window.githubAPI.getFileContent(`${folder.path}/data.json`);
                    if (dataContent) {
                        const developer = JSON.parse(dataContent);
                        this.developers.push(developer);
                    }
                } catch (error) {
                    console.error(`${folder.path} 데이터 로드 오류:`, error);
                }
            }
            
            // 순서대로 정렬
            this.developers.sort((a, b) => a.order - b.order);
            
            // UI 업데이트
            this.renderDevelopers();
        } catch (error) {
            console.error('개발자 목록 로드 오류:', error);
            throw error;
        }
    }

    renderDevelopers() {
        const container = document.getElementById('developers-list');
        container.innerHTML = '';
        
        if (this.developers.length === 0) {
            container.innerHTML = '<div class="empty-message">개발자가 없습니다. 새로운 개발자를 추가해보세요!</div>';
            return;
        }
        
        // 순서대로 정렬
        const sortedDevelopers = [...this.developers].sort((a, b) => a.order - b.order);
        
        // 개발자 그리드
        const developersGrid = document.createElement('div');
        developersGrid.className = 'album-view';
        
        sortedDevelopers.forEach(developer => {
            const developerElement = this.createDeveloperElement(developer);
            developersGrid.appendChild(developerElement);
        });
        
        container.appendChild(developersGrid);
    }

    createDeveloperElement(developer) {
        const developerElement = document.createElement('div');
        developerElement.className = 'developer-item';
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'developer-image-container';
        
        if (developer.imagePath) {
            const image = document.createElement('img');
            image.className = 'developer-image';
            image.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${developer.imagePath}`;
            image.alt = developer.name;
            image.loading = 'lazy';
            imageContainer.appendChild(image);
        }
        
        const info = document.createElement('div');
        info.className = 'developer-info';
        
        const name = document.createElement('h3');
        name.className = 'developer-name';
        name.textContent = developer.name;
        
        info.appendChild(name);
        
        const actions = document.createElement('div');
        actions.className = 'developer-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '수정';
        editBtn.addEventListener('click', () => {
            this.showEditModal(developer);
        });
        
        const upBtn = document.createElement('button');
        upBtn.className = 'order-btn';
        upBtn.textContent = '⬆';
        upBtn.addEventListener('click', () => {
            this.moveDeveloperUp(developer);
        });
        
        const downBtn = document.createElement('button');
        downBtn.className = 'order-btn';
        downBtn.textContent = '⬇';
        downBtn.addEventListener('click', () => {
            this.moveDeveloperDown(developer);
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        
        developerElement.appendChild(imageContainer);
        developerElement.appendChild(info);
        developerElement.appendChild(actions);
        
        return developerElement;
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// 전역 인스턴스 생성
window.developersManager = new DevelopersManager();

