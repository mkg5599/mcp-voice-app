# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy the project files into the container
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install

# Copy the rest of the application's code
COPY . .

# Build the Next.js application
RUN NEXT_PUBLIC_API_URL=http://backend:8000 OPENAI_API_KEY=${OPENAI_API_KEY} pnpm build

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["pnpm", "start"]