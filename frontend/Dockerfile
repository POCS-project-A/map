# 1단계: Node로 React 앱을 빌드한다 (빌드 결과는 플랫폼과 무관한 정적 파일)
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: 빌드된 정적 파일만 nginx로 서빙한다 (기존과 같은 포트 80)
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
