// 학생목록 관리 기능
class StudentsManager {
    constructor() {
        this.students = [];
        this.editingStudent = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 학생 추가 버튼
        document.getElementById('add-student-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 학생 폼 제출
        document.getElementById('student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // 삭제 버튼
        document.getElementById('student-delete').addEventListener('click', () => {
            this.handleDelete();
        });
    }

    showAddModal() {
        this.editingStudent = null;
        window.uiManager.showModal('student-modal', '학생 추가');
        
        // 폼 초기화
        const form = document.getElementById('student-form');
        form.reset();
        
        // 버튼 텍스트 변경
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '추가';
        
        // 삭제 버튼 숨기기
        document.getElementById('student-delete').style.display = 'none';
        
        // 이미지 필수로 설정
        document.getElementById('student-image').required = true;
    }

    showEditModal(student) {
        this.editingStudent = student;
        window.uiManager.showModal('student-modal', '학생 수정');
        
        // 폼에 기존 데이터 채우기
        document.getElementById('student-name').value = student.name;
        document.getElementById('student-type').value = student.type;
        
        // 버튼 텍스트 변경
        const submitBtn = document.querySelector('#student-form button[type="submit"]');
        submitBtn.textContent = '수정';
        
        // 삭제 버튼 표시
        document.getElementById('student-delete').style.display = 'block';
        
        // 이미지 파일 입력은 선택사항으로 변경
        const imageInput = document.getElementById('student-image');
        imageInput.required = false;
    }

    async handleSubmit() {
        const form = document.getElementById('student-form');
        
        const name = document.getElementById('student-name').value.trim();
        const type = document.getElementById('student-type').value;
        const imageFile = document.getElementById('student-image').files[0];

        // 유효성 검사
        if (!name || !type) {
            window.uiManager.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        // 새 학생 추가 시 이미지 필수
        if (!this.editingStudent && (!imageFile || imageFile.size === 0)) {
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
            if (this.editingStudent) {
                await this.updateStudent(name, type, imageFile);
            } else {
                await this.addStudent(name, type, imageFile);
            }
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('학생 정보가 저장되었습니다.', 'success');
            await this.loadStudents();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to save student:', error);
            window.uiManager.showNotification('저장에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async addStudent(name, type, imageFile) {
        const folderName = window.githubAPI.sanitizeFolderName(name);
        
        // 이미지 업로드
        const imageData = await window.githubAPI.fileToBase64(imageFile);
        const imageExtension = imageFile.name.split('.').pop();
        const imagePath = `학생목록/${folderName}/image.${imageExtension}`;
        
        await window.githubAPI.uploadImage(
            imagePath,
            imageData,
            `Add student image: ${name}`
        );

        // 메타데이터 저장
        const studentData = {
            name,
            type,
            imagePath,
            order: this.getNextOrder(type),
            createdAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `학생목록/${folderName}/data.json`,
            studentData,
            `Add student: ${name}`
        );
    }

    async updateStudent(name, type, imageFile) {
        const student = this.editingStudent;
        const oldFolderName = window.githubAPI.sanitizeFolderName(student.name);
        const newFolderName = window.githubAPI.sanitizeFolderName(name);

        let imagePath = student.imagePath;

        // 이미지가 변경된 경우
        if (imageFile && imageFile.size > 0) {
            const imageData = await window.githubAPI.fileToBase64(imageFile);
            const imageExtension = imageFile.name.split('.').pop();
            imagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
            
            await window.githubAPI.uploadImage(
                imagePath,
                imageData,
                `Update student image: ${name}`
            );
        } else if (oldFolderName !== newFolderName) {
            // 폴더명이 변경되었지만 이미지는 그대로인 경우
            const imageExtension = student.imagePath.split('.').pop();
            imagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
        }

        // 메타데이터 업데이트
        const studentData = {
            name,
            type,
            imagePath,
            order: student.order,
            createdAt: student.createdAt,
            updatedAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `학생목록/${newFolderName}/data.json`,
            studentData,
            `Update student: ${name}`
        );

        // 폴더명이 변경된 경우 기존 폴더 삭제
        if (oldFolderName !== newFolderName) {
            await window.githubAPI.deleteFolder(`학생목록/${oldFolderName}`);
        }
    }

    async handleDelete() {
        if (!this.editingStudent) return;

        if (!confirm('정말로 이 학생 정보를 삭제하시겠습니까?')) {
            return;
        }

        const deleteBtn = document.getElementById('student-delete');
        const stopLoading = window.uiManager.showLoading(deleteBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(this.editingStudent.name);
            await window.githubAPI.deleteFolder(`학생목록/${folderName}`);
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('학생 정보가 삭제되었습니다.', 'success');
            await this.loadStudents();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to delete student:', error);
            window.uiManager.showNotification('삭제에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async moveStudent(student, direction) {
        try {
            const sameTypeStudents = this.students.filter(s => s.type === student.type);
            const currentIndex = sameTypeStudents.findIndex(s => s.name === student.name);
            
            if (currentIndex === -1) {
                throw new Error('학생을 찾을 수 없습니다.');
            }
            
            let targetIndex = -1;
            if (direction === 'up' && currentIndex > 0) {
                targetIndex = currentIndex - 1;
            } else if (direction === 'down' && currentIndex < sameTypeStudents.length - 1) {
                targetIndex = currentIndex + 1;
            }
            
            if (targetIndex === -1) {
                window.uiManager.showNotification('더 이상 이동할 수 없습니다.', 'warning');
                return;
            }
            
            const targetStudent = sameTypeStudents[targetIndex];
            await this.swapOrder(student, targetStudent);
            
        } catch (error) {
            console.error('Failed to move student:', error);
            window.uiManager.showNotification('순서 이동에 실패했습니다.', 'error');
        }
    }

    async swapOrder(student1, student2) {
        try {
            // 백업용 원본 order 저장
            const originalOrder1 = student1.order;
            const originalOrder2 = student2.order;
            
            // 임시 order로 변경 (충돌 방지)
            const tempOrder = Math.max(originalOrder1, originalOrder2) + 1000;
            student1.order = tempOrder;
            
            // 첫 번째 학생 업데이트
            await this.updateStudentOrder(student1);
            
            // 두 번째 학생을 첫 번째 학생의 원래 order로 변경
            student2.order = originalOrder1;
            await this.updateStudentOrder(student2);
            
            // 첫 번째 학생을 두 번째 학생의 원래 order로 변경
            student1.order = originalOrder2;
            await this.updateStudentOrder(student1);
            
            await this.loadStudents();
            window.uiManager.showNotification('순서가 변경되었습니다.', 'success');
            
        } catch (error) {
            console.error('Failed to swap order:', error);
            window.uiManager.showNotification('순서 변경에 실패했습니다.', 'error');
            
            // 에러 발생 시 다시 로드하여 원상복구
            await this.loadStudents();
        }
    }

    async updateStudentOrder(student) {
        const folderName = window.githubAPI.sanitizeFolderName(student.name);
        
        // 재시도 로직 추가
        let retries = 3;
        while (retries > 0) {
            try {
                await window.githubAPI.createOrUpdateFile(
                    `학생목록/${folderName}/data.json`,
                    student,
                    `Update order for: ${student.name}`
                );
                return; // 성공시 종료
            } catch (error) {
                retries--;
                if (retries === 0) {
                    throw error;
                }
                // 1초 대기 후 재시도
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    getNextOrder(type) {
        const sameTypeStudents = this.students.filter(s => s.type === type);
        if (sameTypeStudents.length === 0) {
            return 1;
        }
        return Math.max(...sameTypeStudents.map(s => s.order)) + 1;
    }

    async loadStudents() {
        try {
            const folders = await window.githubAPI.listFolderContents('학생목록');
            this.students = [];

            for (const folder of folders) {
                if (folder.type === 'dir') {
                    const studentData = await window.githubAPI.getFileContent(`학생목록/${folder.name}/data.json`);
                    if (studentData) {
                        this.students.push(studentData);
                    }
                }
            }

            // 정렬: 선생님 먼저, 그 다음 학생 (각각 order 순)
            this.students.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'teacher' ? -1 : 1;
                }
                return a.order - b.order;
            });
            
            this.renderStudents();
            
        } catch (error) {
            console.error('Failed to load students:', error);
        }
    }

    async renderStudents() {
        const container = document.getElementById('students-list');
        container.innerHTML = '';

        if (this.students.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #718096; grid-column: 1 / -1;">
                    <p>아직 학생 정보가 없습니다.</p>
                    <p>첫 번째 학생을 추가해보세요!</p>
                </div>
            `;
            return;
        }

        for (const student of this.students) {
            const studentElement = await this.createStudentElement(student);
            container.appendChild(studentElement);
        }
    }

    async createStudentElement(student) {
        const div = document.createElement('div');
        div.className = `student-item ${student.type} fade-in`;
        div.dataset.studentName = student.name;
        div.dataset.studentType = student.type;
        
        const imageUrl = await window.githubAPI.getImageUrl(student.imagePath);
        
        div.innerHTML = `
            <img src="${imageUrl}" alt="${student.name}" class="student-image" loading="lazy" />
            <div class="student-info">
                <h3 class="student-name">${student.name}</h3>
            </div>
            <div class="student-actions">
                <button class="edit-btn">수정</button>
                <button class="order-btn up-btn">⬆</button>
                <button class="order-btn down-btn">⬇</button>
            </div>
        `;

        // 이벤트 리스너 추가
        const editBtn = div.querySelector('.edit-btn');
        const upBtn = div.querySelector('.up-btn');
        const downBtn = div.querySelector('.down-btn');

        editBtn.addEventListener('click', () => {
            this.showEditModal(student);
        });

        upBtn.addEventListener('click', () => {
            this.moveStudent(student, 'up');
        });

        downBtn.addEventListener('click', () => {
            this.moveStudent(student, 'down');
        });

        return div;
    }
}

// 전역 학생 매니저 인스턴스
window.studentsManager = new StudentsManager();

