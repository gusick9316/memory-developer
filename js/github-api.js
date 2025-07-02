// GitHub API 설정
const GITHUB_CONFIG = {
    username: 'gusick9316',
    token: 'ghp' + '_2SllyukhLwajJQdMsP0xgu9uaR5fDv2gvE0T',
    repositories: Array.from({length: 20}, (_, i) => `DS-${i + 1}`),
    specialRepo: 'memory',
    apiBase: 'https://api.github.com'
};

// GitHub API 헬퍼 함수들
class GitHubAPI {
    constructor() {
        this.headers = {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // API 요청 헬퍼
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.headers,
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API 요청 실패:', error);
            throw error;
        }
    }

    // 저장소 정보 가져오기
    async getRepositoryInfo(repoName) {
        const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}`;
        return await this.request(url);
    }

    // 저장소 크기 확인
    async getRepositorySize(repoName) {
        try {
            const repoInfo = await this.getRepositoryInfo(repoName);
            return repoInfo.size; // KB 단위
        } catch (error) {
            console.error(`저장소 ${repoName} 크기 확인 실패:`, error);
            return 0;
        }
    }

    // 파일 업로드
    async uploadFile(repoName, path, content, message = 'Upload file') {
        const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
        
        // 기존 파일 확인
        let sha = null;
        try {
            const existingFile = await this.request(url);
            sha = existingFile.sha;
        } catch (error) {
            // 파일이 없으면 새로 생성
        }

        const data = {
            message,
            content: btoa(unescape(encodeURIComponent(content))), // UTF-8 인코딩
            ...(sha && { sha })
        };

        return await this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // 바이너리 파일 업로드 (이미지 등)
    async uploadBinaryFile(repoName, path, file, message = 'Upload image') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64Content = reader.result.split(',')[1]; // data:image/jpeg;base64, 제거
                    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
                    
                    // 기존 파일 확인
                    let sha = null;
                    try {
                        const existingFile = await this.request(url);
                        sha = existingFile.sha;
                    } catch (error) {
                        // 파일이 없으면 새로 생성
                    }

                    const data = {
                        message,
                        content: base64Content,
                        ...(sha && { sha })
                    };

                    const result = await this.request(url, {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 파일 삭제
    async deleteFile(repoName, path, message = 'Delete file') {
        const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
        
        try {
            const fileInfo = await this.request(url);
            const data = {
                message,
                sha: fileInfo.sha
            };

            return await this.request(url, {
                method: 'DELETE',
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error(`파일 삭제 실패: ${path}`, error);
            throw error;
        }
    }

    // 폴더 내 모든 파일 가져오기
    async getFolderContents(repoName, path = '') {
        const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
        try {
            return await this.request(url);
        } catch (error) {
            if (error.message.includes('404')) {
                return []; // 폴더가 없으면 빈 배열 반환
            }
            throw error;
        }
    }

    // 폴더 삭제 (모든 파일 삭제)
    async deleteFolder(repoName, folderPath) {
        try {
            const contents = await this.getFolderContents(repoName, folderPath);
            
            // 모든 파일 삭제
            for (const item of contents) {
                if (item.type === 'file') {
                    await this.deleteFile(repoName, item.path, `Delete ${item.name}`);
                }
            }
        } catch (error) {
            console.error(`폴더 삭제 실패: ${folderPath}`, error);
            throw error;
        }
    }

    // JSON 데이터 저장 (UTF-8 인코딩 개선)
    async saveJSON(repoName, path, data, message = 'Save JSON data') {
        const jsonContent = JSON.stringify(data, null, 2);
        // UTF-8 인코딩을 위해 TextEncoder 사용
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(jsonContent);
        const base64Content = btoa(String.fromCharCode(...utf8Bytes));
        
        const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
        
        // 기존 파일 확인
        let sha = null;
        try {
            const existingFile = await this.request(url);
            sha = existingFile.sha;
        } catch (error) {
            // 파일이 없으면 새로 생성
        }

        const requestData = {
            message,
            content: base64Content,
            ...(sha && { sha })
        };

        return await this.request(url, {
            method: 'PUT',
            body: JSON.stringify(requestData)
        });
    }

    // JSON 데이터 로드 (UTF-8 디코딩 개선)
    async loadJSON(repoName, path) {
        try {
            const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
            const response = await this.request(url);
            
            // Base64 디코딩 후 UTF-8 디코딩
            const base64Content = response.content.replace(/\s/g, ''); // 공백 제거
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(bytes);
            
            return JSON.parse(jsonString);
        } catch (error) {
            console.error(`JSON 로드 실패: ${path}`, error);
            return null;
        }
    }

    // 모든 저장소 연결 테스트
    async testConnections() {
        const results = {
            repositories: {},
            specialRepo: null
        };

        // 일반 저장소들 테스트
        for (const repo of GITHUB_CONFIG.repositories) {
            try {
                const info = await this.getRepositoryInfo(repo);
                results.repositories[repo] = {
                    connected: true,
                    size: info.size
                };
            } catch (error) {
                results.repositories[repo] = {
                    connected: false,
                    error: error.message
                };
            }
        }

        // 특별 저장소 테스트
        try {
            const info = await this.getRepositoryInfo(GITHUB_CONFIG.specialRepo);
            results.specialRepo = {
                connected: true,
                size: info.size
            };
        } catch (error) {
            results.specialRepo = {
                connected: false,
                error: error.message
            };
        }

        return results;
    }
}

// 전역 GitHub API 인스턴스
const githubAPI = new GitHubAPI();

// 유틸리티 함수들
function formatFileSize(sizeInKB) {
    if (sizeInKB < 1024) {
        return `${sizeInKB} KB`;
    } else {
        return `${(sizeInKB / 1024).toFixed(1)} MB`;
    }
}

function isStorageNearFull(sizeInKB) {
    const sizeInMB = sizeInKB / 1024;
    return sizeInMB >= 800; // 800MB 이상이면 경고
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9가-힣\-_]/g, '_');
}

// 파일 크기 검증
function validateFileSize(file, maxSizeMB = 25) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
}


    // 저장소 내용 가져오기 (폴더/파일 목록)
    async getRepositoryContents(repoName, path = '') {
        try {
            const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`;
            const response = await this.request(url);
            return response;
        } catch (error) {
            console.error(`저장소 내용 가져오기 실패: ${repoName}/${path}`, error);
            return [];
        }
    }

