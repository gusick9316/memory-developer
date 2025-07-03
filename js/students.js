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
        const sameTypeStudents = this.students.filter(s => s.type === student.type);
        const currentIndex = sameTypeStudents.findIndex(s => s.name === student.name);
        
        if (direction === 'up' && currentIndex > 0) {
            // 위로 이동
            const targetStudent = sameTypeStudents[currentIndex - 1];
            await this.swapOrder(student, targetStudent);
        } else if (direction === 'down' && currentIndex < sameTypeStudents.length - 1) {
            // 아래로 이동
            const targetStudent = sameTypeStudents[currentIndex + 1];
            await this.swapOrder(student, targetStudent);
        }
    }

    async swapOrder(student1, student2) {
        try {
            const temp = student1.order;
            student1.order = student2.order;
            student2.order = temp;

            // 두 학생의 데이터 업데이트
            await this.updateStudentOrder(student1);
            await this.updateStudentOrder(student2);
            
            await this.loadStudents();
            window.uiManager.showNotification('순서가 변경되었습니다.', 'success');
            
        } catch (error) {
            console.error('Failed to swap order:', error);
            window.uiManager.showNotification('순서 변경에 실패했습니다.', 'error');
        }
    }

    async updateStudentOrder(student) {
        const folderName = window.githubAPI.sanitizeFolderName(student.name);
        await window.githubAPI.createOrUpdateFile(
            `학생목록/${folderName}/data.json`,
            student,
            `Update order for: ${student.name}`
        );
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
        
        const imageUrl = await window.githubAPI.getImageUrl(student.imagePath);
        
        div.innerHTML = `
            <img src="${imageUrl}" alt="${student.name}" class="student-image" loading="lazy" />
            <div class="student-info">
                <h3 class="student-name">${student.name}</h3>
            </div>
            <div class="student-actions">
                <button class="edit-btn" onclick="window.studentsManager.showEditModal(${JSON.stringify(student).replace(/"/g, '&quot;')})">
                    수정
                </button>
                <button class="order-btn" onclick="window.studentsManager.moveStudent(${JSON.stringify(student).replace(/"/g, '&quot;')}, 'up')">
                    ⬆
                </button>
                <button class="order-btn" onclick="window.studentsManager.moveStudent(${JSON.stringify(student).replace(/"/g, '&quot;')}, 'down')">
                    ⬇
                </button>
            </div>
        `;

        return div;
    }
}

// 전역 학생 매니저 인스턴스
window.studentsManager = new StudentsManager();

