// 개발자 관리 기능
class DevelopersManager {
    constructor() {
        this.developers = [];
        this.editingDeveloper = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 개발자 추가 버튼
        document.getElementById('add-developer-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 개발자 폼 제출
        document.getElementById('developer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // 삭제 버튼
        document.getElementById('developer-delete').addEventListener('click', () => {
            this.handleDelete();
        });
    }

    showAddModal() {
        this.editingDeveloper = null;
        window.uiManager.showModal('developer-modal', '개발자 추가');
        
        // 폼 초기화
        const form = document.getElementById('developer-form');
        form.reset();
        
        // 버튼 텍스트 변경
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '추가';
        
        // 삭제 버튼 숨기기
        document.getElementById('developer-delete').style.display = 'none';
        
        // 이미지 필수로 설정
        document.getElementById('developer-image').required = true;
    }

    showEditModal(developer) {
        this.editingDeveloper = developer;
        window.uiManager.showModal('developer-modal', '개발자 수정');
        
        // 폼에 기존 데이터 채우기
        document.getElementById('developer-name').value = developer.name;
        
        // 버튼 텍스트 변경
        const submitBtn = document.querySelector('#developer-form button[type="submit"]');
        submitBtn.textContent = '수정';
        
        // 삭제 버튼 표시
        document.getElementById('developer-delete').style.display = 'block';
        
        // 이미지 파일 입력은 선택사항으로 변경
        const imageInput = document.getElementById('developer-image');
        imageInput.required = false;
    }

    async handleSubmit() {
        const form = document.getElementById('developer-form');
        
        const name = document.getElementById('developer-name').value.trim();
        const imageFile = document.getElementById('developer-image').files[0];

        // 유효성 검사
        if (!name) {
            window.uiManager.showNotification('이름을 입력해주세요.', 'error');
            return;
        }

        // 새 개발자 추가 시 이미지 필수
        if (!this.editingDeveloper && (!imageFile || imageFile.size === 0)) {
            window.uiManager.showNotification('이미지를 선택해주세요.', 'error');
            return;
        }

        // 이미지 파일 유효성 검사 (파일이 있는 경우)
        if (imageFile && imageFile.size > 0) {
            if (!window.uiManager.validateImageFile(imageFile)) {
                return;
            }
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            if (this.editingDeveloper) {
                await this.updateDeveloper(name, imageFile);
            } else {
                await this.addDeveloper(name, imageFile);
            }
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('개발자 정보가 저장되었습니다.', 'success');
            await this.loadDevelopers();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to save developer:', error);
            window.uiManager.showNotification('저장에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async addDeveloper(name, imageFile) {
        const folderName = window.githubAPI.sanitizeFolderName(name);
        
        // 이미지 업로드
        const imageData = await window.githubAPI.fileToBase64(imageFile);
        const imageExtension = imageFile.name.split('.').pop();
        const imagePath = `개발자/${folderName}/image.${imageExtension}`;
        
        await window.githubAPI.uploadImage(
            imagePath,
            imageData,
            `Add developer image: ${name}`
        );

        // 메타데이터 저장
        const developerData = {
            name,
            imagePath,
            order: this.getNextOrder(),
            createdAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `개발자/${folderName}/data.json`,
            developerData,
            `Add developer: ${name}`
        );
    }

    async updateDeveloper(name, imageFile) {
        const developer = this.editingDeveloper;
        const oldFolderName = window.githubAPI.sanitizeFolderName(developer.name);
        const newFolderName = window.githubAPI.sanitizeFolderName(name);

        let imagePath = developer.imagePath;

        // 이미지가 변경된 경우
        if (imageFile && imageFile.size > 0) {
            const imageData = await window.githubAPI.fileToBase64(imageFile);
            const imageExtension = imageFile.name.split('.').pop();
            imagePath = `개발자/${newFolderName}/image.${imageExtension}`;
            
            await window.githubAPI.uploadImage(
                imagePath,
                imageData,
                `Update developer image: ${name}`
            );
        } else if (oldFolderName !== newFolderName) {
            // 폴더명이 변경되었지만 이미지는 그대로인 경우
            const imageExtension = developer.imagePath.split('.').pop();
            imagePath = `개발자/${newFolderName}/image.${imageExtension}`;
        }

        // 메타데이터 업데이트
        const developerData = {
            name,
            imagePath,
            order: developer.order,
            createdAt: developer.createdAt,
            updatedAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `개발자/${newFolderName}/data.json`,
            developerData,
            `Update developer: ${name}`
        );

        // 폴더명이 변경된 경우 기존 폴더 삭제
        if (oldFolderName !== newFolderName) {
            await window.githubAPI.deleteFolder(`개발자/${oldFolderName}`);
        }
    }

    async handleDelete() {
        if (!this.editingDeveloper) return;

        if (!confirm('정말로 이 개발자 정보를 삭제하시겠습니까?')) {
            return;
        }

        const deleteBtn = document.getElementById('developer-delete');
        const stopLoading = window.uiManager.showLoading(deleteBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(this.editingDeveloper.name);
            await window.githubAPI.deleteFolder(`개발자/${folderName}`);
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('개발자 정보가 삭제되었습니다.', 'success');
            await this.loadDevelopers();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to delete developer:', error);
            window.uiManager.showNotification('삭제에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async moveDeveloper(developer, direction) {
        const currentIndex = this.developers.findIndex(d => d.name === developer.name);
        
        if (direction === 'up' && currentIndex > 0) {
            // 위로 이동
            const targetDeveloper = this.developers[currentIndex - 1];
            await this.swapOrder(developer, targetDeveloper);
        } else if (direction === 'down' && currentIndex < this.developers.length - 1) {
            // 아래로 이동
            const targetDeveloper = this.developers[currentIndex + 1];
            await this.swapOrder(developer, targetDeveloper);
        }
    }

    async swapOrder(developer1, developer2) {
        try {
            const temp = developer1.order;
            developer1.order = developer2.order;
            developer2.order = temp;

            // 두 개발자의 데이터 업데이트
            await this.updateDeveloperOrder(developer1);
            await this.updateDeveloperOrder(developer2);
            
            await this.loadDevelopers();
            window.uiManager.showNotification('순서가 변경되었습니다.', 'success');
            
        } catch (error) {
            console.error('Failed to swap order:', error);
            window.uiManager.showNotification('순서 변경에 실패했습니다.', 'error');
        }
    }

    async updateDeveloperOrder(developer) {
        const folderName = window.githubAPI.sanitizeFolderName(developer.name);
        await window.githubAPI.createOrUpdateFile(
            `개발자/${folderName}/data.json`,
            developer,
            `Update order for: ${developer.name}`
        );
    }

    getNextOrder() {
        if (this.developers.length === 0) {
            return 1;
        }
        return Math.max(...this.developers.map(d => d.order)) + 1;
    }

    async loadDevelopers() {
        try {
            const folders = await window.githubAPI.listFolderContents('개발자');
            this.developers = [];

            for (const folder of folders) {
                if (folder.type === 'dir') {
                    const developerData = await window.githubAPI.getFileContent(`개발자/${folder.name}/data.json`);
                    if (developerData) {
                        this.developers.push(developerData);
                    }
                }
            }

            // order 순으로 정렬
            this.developers.sort((a, b) => a.order - b.order);
            
            this.renderDevelopers();
            
        } catch (error) {
            console.error('Failed to load developers:', error);
        }
    }

    async renderDevelopers() {
        const container = document.getElementById('developers-list');
        container.innerHTML = '';

        if (this.developers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #718096; grid-column: 1 / -1;">
                    <p>아직 개발자 정보가 없습니다.</p>
                    <p>첫 번째 개발자를 추가해보세요!</p>
                </div>
            `;
            return;
        }

        for (const developer of this.developers) {
            const developerElement = await this.createDeveloperElement(developer);
            container.appendChild(developerElement);
        }
    }

    async createDeveloperElement(developer) {
        const div = document.createElement('div');
        div.className = 'developer-item fade-in';
        
        const imageUrl = await window.githubAPI.getImageUrl(developer.imagePath);
        
        div.innerHTML = `
            <img src="${imageUrl}" alt="${developer.name}" class="developer-image" loading="lazy" />
            <div class="developer-info">
                <h3 class="developer-name">${developer.name}</h3>
            </div>
            <div class="developer-actions">
                <button class="edit-btn" onclick="window.developersManager.showEditModal(${JSON.stringify(developer).replace(/"/g, '&quot;')})">
                    수정
                </button>
                <button class="order-btn" onclick="window.developersManager.moveDeveloper(${JSON.stringify(developer).replace(/"/g, '&quot;')}, 'up')">
                    ⬆
                </button>
                <button class="order-btn" onclick="window.developersManager.moveDeveloper(${JSON.stringify(developer).replace(/"/g, '&quot;')}, 'down')">
                    ⬇
                </button>
            </div>
        `;

        return div;
    }
}

// 전역 개발자 매니저 인스턴스
window.developersManager = new DevelopersManager();

