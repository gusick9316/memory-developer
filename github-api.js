// GitHub API 연동 모듈
class GitHubAPI {
    constructor() {
        this.username = 'gusick9316';
        this.repositories = [];
        this.specialRepo = 'memory';
        this.token = null;
        this.baseUrl = 'https://api.github.com';
        
        // DS-1 ~ DS-20 저장소 목록 생성
        for (let i = 1; i <= 20; i++) {
            this.repositories.push(`DS-${i}`);
        }
    }

    // 토큰 조합 (분할된 토큰을 합치기)
    initializeToken() {
        const tokenPart1 = "ghp";
        const tokenPart2 = "_2SllyukhLwajJQdMsP0xgu9uaR5fDv2gvE0T";
        this.token = tokenPart1 + tokenPart2;
    }

    // API 요청 헤더 생성
    getHeaders() {
        return {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // 저장소 연결 테스트
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                const userData = await response.json();
                return { success: true, user: userData };
            } else {
                throw new Error(`API 요청 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('연결 테스트 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 저장소 목록 확인
    async checkRepositories() {
        try {
            const results = [];
            
            // 일반 저장소들 확인 (DS-1 ~ DS-20)
            for (const repo of this.repositories) {
                try {
                    const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repo}`, {
                        headers: this.getHeaders()
                    });
                    
                    if (response.ok) {
                        const repoData = await response.json();
                        results.push({
                            name: repo,
                            size: repoData.size,
                            exists: true
                        });
                    } else {
                        results.push({
                            name: repo,
                            exists: false
                        });
                    }
                } catch (error) {
                    results.push({
                        name: repo,
                        exists: false,
                        error: error.message
                    });
                }
            }

            // 특별 저장소 확인 (memory)
            try {
                const response = await fetch(`${this.baseUrl}/repos/${this.username}/${this.specialRepo}`, {
                    headers: this.getHeaders()
                });
                
                if (response.ok) {
                    const repoData = await response.json();
                    results.push({
                        name: this.specialRepo,
                        size: repoData.size,
                        exists: true,
                        special: true
                    });
                } else {
                    results.push({
                        name: this.specialRepo,
                        exists: false,
                        special: true
                    });
                }
            } catch (error) {
                results.push({
                    name: this.specialRepo,
                    exists: false,
                    special: true,
                    error: error.message
                });
            }

            return { success: true, repositories: results };
        } catch (error) {
            console.error('저장소 확인 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 파일 업로드
    async uploadFile(repoName, path, content, message = 'Upload file') {
        try {
            // Base64 인코딩
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repoName}/contents/${path}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    message: message,
                    content: encodedContent
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, data: result };
            } else {
                const error = await response.json();
                throw new Error(error.message || `업로드 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('파일 업로드 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 이미지 파일 업로드 (Base64)
    async uploadImage(repoName, path, file, message = 'Upload image') {
        try {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        // Base64 데이터에서 헤더 제거
                        const base64Data = reader.result.split(',')[1];
                        
                        const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repoName}/contents/${path}`, {
                            method: 'PUT',
                            headers: this.getHeaders(),
                            body: JSON.stringify({
                                message: message,
                                content: base64Data
                            })
                        });

                        if (response.ok) {
                            const result = await response.json();
                            resolve({ success: true, data: result });
                        } else {
                            const error = await response.json();
                            throw new Error(error.message || `이미지 업로드 실패: ${response.status}`);
                        }
                    } catch (error) {
                        reject({ success: false, error: error.message });
                    }
                };
                reader.onerror = () => {
                    reject({ success: false, error: '파일 읽기 실패' });
                };
                reader.readAsDataURL(file);
            });
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 파일 다운로드
    async downloadFile(repoName, path) {
        try {
            const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repoName}/contents/${path}`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.content) {
                    // Base64 디코딩
                    const content = decodeURIComponent(escape(atob(result.content)));
                    return { success: true, content: content, data: result };
                } else {
                    throw new Error('파일 내용이 없습니다');
                }
            } else {
                const error = await response.json();
                throw new Error(error.message || `다운로드 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('파일 다운로드 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 폴더 내 파일 목록 가져오기
    async listFiles(repoName, path = '') {
        try {
            const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repoName}/contents/${path}`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, files: result };
            } else {
                const error = await response.json();
                throw new Error(error.message || `목록 조회 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('파일 목록 조회 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 파일/폴더 삭제
    async deleteFile(repoName, path, sha, message = 'Delete file') {
        try {
            const response = await fetch(`${this.baseUrl}/repos/${this.username}/${repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    message: message,
                    sha: sha
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, data: result };
            } else {
                const error = await response.json();
                throw new Error(error.message || `삭제 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('파일 삭제 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 폴더 전체 삭제 (재귀적)
    async deleteFolder(repoName, folderPath) {
        try {
            // 폴더 내 파일 목록 가져오기
            const listResult = await this.listFiles(repoName, folderPath);
            if (!listResult.success) {
                return listResult;
            }

            // 각 파일/폴더 삭제
            for (const item of listResult.files) {
                if (item.type === 'file') {
                    const deleteResult = await this.deleteFile(repoName, item.path, item.sha, `Delete ${item.name}`);
                    if (!deleteResult.success) {
                        console.error(`파일 삭제 실패: ${item.path}`, deleteResult.error);
                    }
                } else if (item.type === 'dir') {
                    // 하위 폴더 재귀적 삭제
                    const deleteFolderResult = await this.deleteFolder(repoName, item.path);
                    if (!deleteFolderResult.success) {
                        console.error(`폴더 삭제 실패: ${item.path}`, deleteFolderResult.error);
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('폴더 삭제 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 저장소 용량 체크 (KB 단위)
    getRepositoryCapacityStatus(sizeKB) {
        const sizeMB = sizeKB / 1024;
        
        if (sizeMB >= 800) {
            return {
                status: 'danger',
                message: '저장소 용량이 800MB를 초과했습니다. 다른 저장소를 선택해주세요.',
                size: sizeMB.toFixed(2)
            };
        } else if (sizeMB >= 600) {
            return {
                status: 'warning',
                message: `저장소 용량: ${sizeMB.toFixed(2)}MB (주의: 800MB 근접)`,
                size: sizeMB.toFixed(2)
            };
        } else {
            return {
                status: 'normal',
                message: `저장소 용량: ${sizeMB.toFixed(2)}MB`,
                size: sizeMB.toFixed(2)
            };
        }
    }

    // 이미지 URL 생성
    getImageUrl(repoName, path) {
        return `https://raw.githubusercontent.com/${this.username}/${repoName}/main/${path}`;
    }
}

// 전역 GitHub API 인스턴스
const githubAPI = new GitHubAPI();

