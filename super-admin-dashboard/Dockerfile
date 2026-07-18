FROM node:20-alpine AS build

WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY super-admin-dashboard/package*.json ./
RUN npm ci

COPY super-admin-dashboard/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY super-admin-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
