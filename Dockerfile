FROM node:20-bookworm-slim

# Install system dependencies: Python3, python-is-python3 symlink, FFmpeg, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Ensure python symlink exists for yt-dlp-exec
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Install latest yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install npm dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Environment
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
