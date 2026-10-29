# MusicStep-v1.4.1 — GitHub · Vercel 업로드

## 올릴 파일

`2026-10-29-MusicStep-v1.4.1-github/` 안의 파일과 폴더 전체가 저장소 내용입니다. 이 폴더 자체를 한 단계 더 감싸지 말고, 그 안의 `package.json`, `index.html`, `public/` 등이 저장소 최상위에 오게 올리세요. ZIP 파일 자체를 저장소에 올리는 방식은 배포용 소스 업로드가 아닙니다.

샘플 음악·자막, 실제 파일명과 진단 결과, Python 변환 환경, node_modules, dist, 과거 버전 ZIP은 제외했습니다. 빠른 보컬 감지와 선택형 정밀 분석에 쓰는 두 모델과 ONNX 런타임·라이선스만 포함합니다. 과거 YAMNet·Silero 모델과 MediaPipe 런타임은 현재 UI에서 쓰지 않으므로 이 폴더에 없습니다. 원래 작업 폴더의 파일은 보존합니다.

## GitHub에 올리기

정밀 분석 모델이 66,762,490바이트입니다. GitHub 웹의 파일별 25MiB 업로드 제한을 넘으므로 **GitHub Desktop 또는 Git**으로 올리세요. 모든 파일은 일반 Git의 파일별 100MiB 제한보다 작아 Git LFS 설정은 필요하지 않습니다. GitHub Desktop에서는 이 폴더로 로컬 저장소를 만든 뒤 파일 목록을 확인하고 Commit → Publish repository를 사용하세요. 아래 CLI 방식도 가능합니다.

```powershell
# 업로드 전용 폴더 안에서 실행합니다.
git init
git add .
git status --short
git commit -m "Release MusicStep v1.4.1"
git branch -M main
# GitHub에서 빈 저장소를 만든 후 아래 주소를 실제 주소로 바꿉니다.
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

이 안내 작성 중에는 저장소 생성, 커밋, GitHub 업로드, 계정 변경을 실행하지 않았습니다.

## Vercel에 연결하기

Vercel에서 해당 GitHub 저장소를 Import합니다. Root Directory는 저장소 최상위, Framework는 Vite, Install Command는 `npm ci`, Build Command는 `npm run build`, Output Directory는 `dist`입니다. `vercel.json`이 빌드와 보안 헤더를 제공합니다. Node.js는 Vite 7 호환 버전인 22.12 이상을 사용하세요.

Vercel의 System Environment Variables 접근을 켜세요. 빌드 시 `VERCEL_PROJECT_PRODUCTION_URL`을 읽어 `og:image`, Twitter 이미지, `og:url`, canonical에 실제 HTTPS 서비스 주소를 넣습니다. 별도 도메인을 고정하고 싶다면 Vercel 환경변수 **SITE_URL=https://실제도메인**을 설정하고 다시 배포하세요. 경로·쿼리가 없는 HTTPS 도메인 주소를 사용합니다. `.env`나 비밀 키를 저장소에 올릴 필요가 없습니다.

우선순위: SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL. 일반 로컬 빌드는 공개 주소를 지어내지 않고 `/og-image.png`를 사용합니다. Vercel 환경에서 주소를 전혀 받지 못하면 잘못된 공유 태그로 배포하지 않도록 빌드를 중단하고 설정 방법을 표시합니다.

## 배포 후 확인

- `/og-image.png`가 열리고 크기가 1200×630인지 확인합니다.
- 페이지 소스에서 `og:image`와 `twitter:image`가 실제 HTTPS 도메인의 `/og-image.png`를 가리키는지 확인합니다.
- 링크 공유 미리보기는 플랫폼 캐시에 따라 갱신이 늦을 수 있습니다. 플랫폼 검사 도구에서 실제 공개 URL로 확인하세요.
- 음악·SRT를 불러와 빠른 분석과 내보내기를 확인하세요. 모델 다운로드만 발생하며 선택한 음악·자막은 업로드하지 않습니다.

실제 GitHub 업로드·Vercel 배포·외부 공유 크롤러 동작은 아직 검증하지 않았습니다.

## 근거

- [GitHub 파일 업로드 제한](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
