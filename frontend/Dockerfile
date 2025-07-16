# Use an official Node.js runtime as a parent image
FROM node:18-alpine

ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Set the working directory in the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install

# Clear Next.js build cache
RUN rm -rf .next

# Copy application files
COPY src ./src
COPY public ./public
COPY next.config.ts ./
COPY tsconfig.json ./
COPY eslint.config.mjs ./
COPY postcss.config.mjs ./

# Build the Next.js application
RUN NEXT_PUBLIC_API_URL=http://backend:8000 GEMINI_API_KEY=${GEMINI_API_KEY} pnpm build

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["pnpm", "start"]