class GitHubAPI {
    constructor() {
        this.username = null;
        this.repo = null;
        this.token = null;
        this.baseUrl = 'https://api.github.com';
    }

    async init(username, repo, token) {
        this.username = username;
        this.repo = repo;
        this.token = token;

        try {
            // 저장소 정보 확인
            const repoInfo = await this.getRepoInfo();
            return repoInfo;
        } catch (error) {
            console.error('GitHub API 초기화 오류:', error);
            throw error;
        }
    }

    async getRepoInfo() {
        const url = `${this.baseUrl}/repos/${this.username}/${this.repo}`;
        const response = await this.fetchWithAuth(url);
        
        if (!response.ok) {
            throw new Error(`저장소 정보를 가져오는데 실패했습니다: ${response.status}`);
        }
        
        return await response.json();
    }

    async getRepoSize() {
        try {
            const repoInfo = await this.getRepoInfo();
            // 크기는 KB 단위로 반환되므로 MB로 변환
            return Math.round(repoInfo.size / 1024);
        } catch (error) {
            console.error('저장소 크기 확인 오류:', error);
            return 0;
        }
    }

    async getFileContent(path) {
        try {
            const url = `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`;
            const response = await this.fetchWithAuth(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // 파일이 없는 경우
                }
                throw new Error(`파일 내용을 가져오는데 실패했습니다: ${response.status}`);
            }
            
            const data = await response.json();
            return atob(data.content); // Base64 디코딩
        } catch (error) {
            console.error(`파일 내용 가져오기 오류 (${path}):`, error);
            return null;
        }
    }

    async uploadFile(path, content, message) {
        try {
            // 기존 파일 확인
            let sha = null;
            try {
                const existingFile = await this.fetchWithAuth(
                    `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`
                );
                
                if (existingFile.ok) {
                    const fileData = await existingFile.json();
                    sha = fileData.sha;
                }
            } catch (error) {
                // 파일이 없는 경우 무시
            }

            // 파일 업로드
            const url = `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`;
            const body = {
                message,
                content: btoa(content), // Base64 인코딩
                branch: 'main'
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await this.fetchWithAuth(url, {
                method: 'PUT',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`파일 업로드에 실패했습니다: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`파일 업로드 오류 (${path}):`, error);
            throw error;
        }
    }

    async uploadImage(path, base64Data, message) {
        try {
            // 이미지 데이터가 이미 Base64 형식인지 확인
            let content = base64Data;
            if (base64Data.startsWith('data:image')) {
                // data:image/jpeg;base64,/9j/... 형식에서 실제 Base64 부분만 추출
                content = base64Data.split(',')[1];
            }

            // 기존 파일 확인
            let sha = null;
            try {
                const existingFile = await this.fetchWithAuth(
                    `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`
                );
                
                if (existingFile.ok) {
                    const fileData = await existingFile.json();
                    sha = fileData.sha;
                }
            } catch (error) {
                // 파일이 없는 경우 무시
            }

            // 이미지 업로드
            const url = `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`;
            const body = {
                message,
                content,
                branch: 'main'
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await this.fetchWithAuth(url, {
                method: 'PUT',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`이미지 업로드에 실패했습니다: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`이미지 업로드 오류 (${path}):`, error);
            throw error;
        }
    }

    async deleteFile(path, message = '파일 삭제') {
        try {
            // 파일 정보 가져오기
            const fileResponse = await this.fetchWithAuth(
                `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`
            );
            
            if (!fileResponse.ok) {
                if (fileResponse.status === 404) {
                    return null; // 파일이 이미 없는 경우
                }
                throw new Error(`파일 정보를 가져오는데 실패했습니다: ${fileResponse.status}`);
            }
            
            const fileData = await fileResponse.json();
            
            // 파일 삭제
            const url = `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`;
            const body = {
                message,
                sha: fileData.sha,
                branch: 'main'
            };

            const response = await this.fetchWithAuth(url, {
                method: 'DELETE',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`파일 삭제에 실패했습니다: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`파일 삭제 오류 (${path}):`, error);
            throw error;
        }
    }

    async deleteFolder(path) {
        try {
            // 폴더 내용 가져오기
            const folderResponse = await this.fetchWithAuth(
                `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`
            );
            
            if (!folderResponse.ok) {
                if (folderResponse.status === 404) {
                    return null; // 폴더가 이미 없는 경우
                }
                throw new Error(`폴더 정보를 가져오는데 실패했습니다: ${folderResponse.status}`);
            }
            
            const folderContents = await folderResponse.json();
            
            // 폴더 내 모든 파일 삭제
            for (const item of folderContents) {
                if (item.type === 'file') {
                    await this.deleteFile(item.path, `Delete ${item.name}`);
                } else if (item.type === 'dir') {
                    await this.deleteFolder(item.path);
                }
            }
            
            return true;
        } catch (error) {
            console.error(`폴더 삭제 오류 (${path}):`, error);
            throw error;
        }
    }

    async listFolderContents(path) {
        try {
            const url = `${this.baseUrl}/repos/${this.username}/${this.repo}/contents/${path}`;
            const response = await this.fetchWithAuth(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return []; // 폴더가 없는 경우
                }
                throw new Error(`폴더 내용을 가져오는데 실패했습니다: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`폴더 내용 가져오기 오류 (${path}):`, error);
            return [];
        }
    }

    // 폴더명 생성 (특수문자 제거)
    sanitizeFolderName(name) {
        return name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
    }

    async fetchWithAuth(url, options = {}) {
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        return fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {})
            }
        });
    }
}

// 전역 인스턴스 생성
window.githubAPI = new GitHubAPI();

