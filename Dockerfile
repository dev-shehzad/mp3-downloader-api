FROM node:20-bullseye-slim

# Install system dependencies: Python3, FFmpeg, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set up standard non-root user (compatible with Hugging Face Spaces, Render, and standard Docker)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Install npm dependencies
COPY --chown=user package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY --chown=user . .

# Environment (7860 is default for Hugging Face, or uses process.env.PORT)
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

CMD ["node", "server.js"]
